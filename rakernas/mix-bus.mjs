#!/usr/bin/env node
// node mix-bus.mjs  ->  assets/mix/bus.mp3 (musik + SFX dalam SATU bus) + tabel level per scene.
//
// Urutan kerja: generate-audio.mjs -> mix-bus.mjs -> build.mjs -> render.
// Bus ini memuat semua musik dan SFX; VO tetap klip terpisah (index.html), lalu dimix + dimaster oleh render.
//   - musik: low-pass ~9 kHz, intensitas LOW-MEDIUM-HIGH (data.json > elevenlabs.music.intensity), ducking VO (cosine),
//            potongan -3 dB pada 2-4 kHz saat VO bicara (agar suara jelas), fade in/out baked
//   - SFX  : dilevelkan terhadap musik (selisih antar layer <= 3 dB; whoosh sengaja lebih lembut), fade in/out, diturunkan saat VO,
//            maksimum DUA SFX aktif bersamaan (yang berprioritas rendah dibuang)
//   - bus  : semua musik + SFX melewati SATU reverb hall (konvolusi IR sintetis, decay ~1,8 dtk, ~14% wet), limiter lembut
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SR = 48000;
const d = JSON.parse(readFileSync("data.json", "utf8"));
const total = d.timing.total, N = Math.ceil(total * SR);
const tmp = mkdtempSync(join(tmpdir(), "rk-bus-"));
process.on("exit", () => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });
const MU = d.elevenlabs.music;
const CFG = { lowpassHz: 9000, dipDb: -3, dipBand: [2000, 4000], reverb: { rt60: 1.8, wet: 0.14, preDelay: 0.02 }, sfxUnderVo: d.sfx.sfxUnderVo ?? 0.45, maxConcurrent: 2, ...(d.mix || {}) };

// ---------- util ----------
const ff = (args, opt = {}) => spawnSync("ffmpeg", ["-v", "error", ...args], { maxBuffer: 1 << 30, ...opt });
function decode(src, filter, secs) {
  const a = ["-i", src, ...(secs ? ["-t", String(secs)] : []), "-ac", "1", "-ar", String(SR)];
  if (filter) a.push("-af", filter);
  const r = ff([...a, "-f", "f32le", "-"]);
  if (r.status !== 0) throw new Error("decode gagal: " + src + "\n" + r.stderr);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
const rmsActive = (x, thr = -30) => {   // RMS (dB) pada frame aktif (di atas puncak - thr dB)
  const H = 480; const fr = []; let pk = 0;
  for (let i = 0; i + H <= x.length; i += H) { let e = 0; for (let j = 0; j < H; j++) e += x[i + j] ** 2; e /= H; fr.push(e); pk = Math.max(pk, e); }
  const lim = pk * 10 ** (thr / 10), act = fr.filter((e) => e >= lim);
  return { rms: act.length ? 10 * Math.log10(act.reduce((a, b) => a + b, 0) / act.length + 1e-12) : -99, activeSec: (() => { let last = 0; fr.forEach((e, i) => { if (e >= lim) last = i + 1; }); return last * H / SR; })() };
};
const smooth = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

// ---------- timeline ----------
const scenes = d.timing.scenes, start = Object.fromEntries(scenes.map((s) => [s.id, s.start])), sdur = Object.fromEntries(scenes.map((s) => [s.id, s.end - s.start]));
const voWins = d.vo.slots.filter((s) => s.duck !== false).map((s) => ({ a: s.start, b: s.start + s.dur }));
const ATT = d.vo.duck.attack ?? 0.2, REL = d.vo.duck.release ?? 0.8;
// S(t) in [0,1]: 1 saat VO bicara (cosine), attack selesai tepat saat VO mulai, release setelah VO selesai
const duckS = (t, att, rel) => voWins.reduce((m, w) => Math.max(m, smooth((t - (w.a - att)) / att) * (1 - smooth((t - w.b) / rel))), 0);
const RATE = 1000, M1 = Math.ceil(total * RATE) + 2;
const envMusic = new Float32Array(M1), envDip = new Float32Array(M1), envSfx = new Float32Array(M1);
const lowGain = 10 ** ((d.vo.duck.db ?? -8) / 20), dipLow = 10 ** (CFG.dipDb / 20);
for (let i = 0; i < M1; i++) { const t = i / RATE; envMusic[i] = 1 - (1 - lowGain) * duckS(t, ATT, REL); envDip[i] = 1 - (1 - dipLow) * duckS(t, ATT, REL); envSfx[i] = 1 - (1 - CFG.sfxUnderVo) * duckS(t, 0.15, 0.5); }
const at1k = (env, t) => { const p = Math.min(M1 - 2, Math.max(0, t * RATE)), i = Math.floor(p), f = p - i; return env[i] * (1 - f) + env[i + 1] * f; };

// ---------- 1. MUSIK: target level (LUFS, tanpa VO) per titik waktu -> gain dB otomatis, dikalibrasi iteratif ----------
// data.json > elevenlabs.music.targets: kunci {scene, t (detik | cue | "sceneEnd"), off, lufs}. Antar kunci diinterpolasi LINEAR dalam dB
// (mulus; perubahan >= 1,5 dtk). Gain = target - level alami trek (RMS 8 dtk) - gain master; per scene dikoreksi (adj) sampai
// hasil ukur ebur128 sama dengan target.
const bgm = "assets/music/bgm-main.mp3";
if (!existsSync(bgm)) throw new Error("assets/music/bgm-main.mp3 tidak ada: jalankan node generate-audio.mjs --only=music");
const lp = `lowpass=f=${CFG.lowpassHz}`;
const full = decode(bgm, lp, total + 1), band = decode(bgm, `${lp},highpass=f=${CFG.dipBand[0]},lowpass=f=${CFG.dipBand[1]}`, total + 1);
const FI = MU.fadeIn ?? 2, FO = MU.fadeOut ?? 3;
const sceneOf = (t) => (scenes.find((x) => t >= x.start && t < x.end) || scenes[scenes.length - 1]).id;
const tg = MU.targets.map((k) => { const rel = k.t === "sceneEnd" ? sdur[k.scene] : typeof k.t === "number" ? k.t : d.audio.cues[k.scene]?.[k.t]; if (rel == null) throw new Error(`musik: cue ${k.t} tidak ada di ${k.scene}`); return { t: start[k.scene] + rel + (k.off || 0), lufs: k.lufs, scene: k.scene }; }).sort((a, b) => a.t - b.t);
// level alami trek (dB RMS, jendela Hann +-4 dtk), per detik
const secs = Math.ceil(total) + 1, nat = new Float32Array(secs);
for (let s0 = 0; s0 < secs; s0++) { let e = 0, w = 0; for (let k = -4; k <= 4; k++) { const sec = Math.min(secs - 2, Math.max(0, s0 + k)), a0 = sec * SR, hw = 0.5 + 0.5 * Math.cos(Math.PI * k / 5); let p = 0; for (let i = a0; i < Math.min(full.length, a0 + SR); i += 4) p += full[i] ** 2; e += hw * p / (SR / 4); w += hw; } nat[s0] = 10 * Math.log10(e / w + 1e-10); }
const natDb = (t) => { const p = Math.min(secs - 2, Math.max(0, t)), i = Math.floor(p), f = p - i; return nat[i] * (1 - f) + nat[i + 1] * f; };
const voBus = new Float32Array(N);
for (const sl of d.vo.slots) { const x = decode(sl.file); const o = Math.round(sl.start * SR); for (let i = 0; i < x.length && o + i < N; i++) voBus[o + i] += x[i] * (sl.gain ?? 1); }
const lufs = (arrs, a, b) => {   // arrs: [L] atau [L,R]; ebur128 stereo
  const i0 = Math.floor(a * SR), i1 = Math.min(N, Math.floor(b * SR)), n = i1 - i0, o = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { o[2 * i] = arrs[0][i0 + i]; o[2 * i + 1] = (arrs[1] || arrs[0])[i0 + i]; }
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"], { input: Buffer.from(o.buffer), encoding: "utf8", maxBuffer: 1 << 26 });
  const sum = r.stderr.slice(r.stderr.lastIndexOf("Summary:")), m = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(sum);
  return m && m[1] !== "-inf" ? +m[1] : -99;
};
const adj = Object.fromEntries(scenes.map((x) => [x.id, 0]));
const targetAt = (t) => { // LUFS target (tanpa VO) pada t, interpolasi dB + koreksi per scene
  const g = (k) => k.lufs + adj[k.scene];
  if (t <= tg[0].t) return g(tg[0]); if (t >= tg[tg.length - 1].t) return g(tg[tg.length - 1]);
  for (let i = 1; i < tg.length; i++) if (t <= tg[i].t) { const a = tg[i - 1], b = tg[i]; return b.t === a.t ? g(b) : g(a) + ((g(b) - g(a)) * (t - a.t)) / (b.t - a.t); }
};
const sceneTargetMean = Object.fromEntries(scenes.map((x) => { let e = 0, n = 0; for (let t = x.start; t < x.end; t += 0.5) { e += 10 ** (targetAt0(t) / 10); n++; } return [x.id, 10 * Math.log10(e / n)]; }));
function targetAt0(t) { const g = (k) => k.lufs; if (t <= tg[0].t) return g(tg[0]); if (t >= tg[tg.length - 1].t) return g(tg[tg.length - 1]); for (let i = 1; i < tg.length; i++) if (t <= tg[i].t) { const a = tg[i - 1], b = tg[i]; return b.t === a.t ? g(b) : g(a) + ((g(b) - g(a)) * (t - a.t)) / (b.t - a.t); } }
let musicFree = new Float32Array(N), music = new Float32Array(N), G = 6, iterInfo = [];
const envInt = new Float32Array(M1);
for (let iter = 0; iter < 5; iter++) {
  for (let i = 0; i < M1; i++) { const t = i / RATE; envInt[i] = 10 ** ((targetAt(t) - G - natDb(t)) / 20); }
  for (let i = 0; i < N; i++) {
    const t = i / SR, x = i < full.length ? full[i] : 0, bnd = i < band.length ? band[i] : 0;
    let g = envInt[Math.min(M1 - 1, Math.round(t * RATE))];
    if (t < FI) g *= t / FI; if (total - t < FO) g *= Math.max(0, (total - t) / FO);
    musicFree[i] = x * g;
    music[i] = (x - bnd * (1 - at1k(envDip, t))) * g * at1k(envMusic, t);   // -3 dB pada 2-4 kHz saat VO + ducking
  }
  const mx = [new Float32Array(N), new Float32Array(N)]; for (let i = 0; i < N; i++) { mx[0][i] = music[i] + voBus[i]; mx[1][i] = mx[0][i]; }
  G = -14 - lufs(mx, 0, total);
  let worst = 0;
  for (const sc of scenes) { const m = lufs([musicFree], sc.start + (sc.id === "s1" ? 0 : 0), sc.end) + G; const err = sceneTargetMean[sc.id] - m; worst = Math.max(worst, Math.abs(err)); adj[sc.id] += err * 0.9; }
  iterInfo.push({ iter, masterDb: +G.toFixed(2), maxErrDb: +worst.toFixed(2) });
  if (worst < 0.6) break;
}
console.log("Kalibrasi level musik:", JSON.stringify(iterInfo));

// ---------- 2. SFX: resolusi event, level, batas serentak ----------
const resolve = (e) => { const rel = typeof e.t === "number" ? e.t : e.t === "sceneEnd" ? sdur[e.scene] : d.audio.cues[e.scene]?.[e.t]; if (rel == null) throw new Error(`SFX ${e.f}: cue ${e.t} tidak ada di ${e.scene}`); return start[e.scene] + rel + (e.off || 0); };
const CAT = { // offset level terhadap musik (dB); semua dalam rentang 3 dB (+1..-2) kecuali whoosh (sengaja lebih lembut)
  "opening-hit": 1, "initiatives-2027-hit": 1, riser: 0, "logo-swell": 0, "timpani-roll": 0, "card-swell": -1, chime: -2, sparkle: -2, "tick-run": -2, applause: -2, whoosh: -14 };
const PRIO = { "opening-hit": 10, "initiatives-2027-hit": 10, riser: 9, "logo-swell": 8, "timpani-roll": 7, "card-swell": 6, whoosh: 5, chime: 4, applause: 3, "tick-run": 2, sparkle: 1 };
const FADE = { whoosh: [0.1, 0.1] };   // fade in/out whoosh 100 ms
const cache = {};
const loadSfx = (name) => {
  if (cache[name]) return cache[name];
  const m = d.sfx.files[name]; if (!m || !m.file) throw new Error(`SFX ${name}: metadata tidak ada di data.json`);
  const x = decode(`assets/sfx/${m.file}`, name === "whoosh" ? "lowpass=f=4500" : null), a = rmsActive(x);
  return (cache[name] = { x, meta: m, rms: a.rms, activeSec: a.activeSec });
};
let evs = d.sfx.events.map((e, i) => {
  const s = loadSfx(e.f), atT = resolve(e), st = Math.max(0, atT + 1 / 30 - s.meta.peak);
  const dur = Math.min(e.dur ?? s.x.length / SR, s.x.length / SR, total - st), act = Math.min(dur, s.activeSec);
  return { i, f: e.f, scene: e.scene, t: e.t, at: atT, st, dur, act, prio: PRIO[e.f] ?? 1, note: e.note };
});
// batas serentak: maks 2 SFX aktif (interval aktif) pada satu momen; buang yang berprioritas rendah
const kept = [], dropped = [];
for (const e of [...evs].sort((a, b) => b.prio - a.prio || a.st - b.st)) {
  const ov = (x) => x.st < e.st + e.act && x.st + x.act > e.st;
  let ok = true; const pts = [e.st, ...kept.filter(ov).map((x) => x.st)].filter((t) => t >= e.st && t < e.st + e.act);
  for (const t of pts) if (kept.filter((x) => x.st <= t && x.st + x.act > t).length >= CFG.maxConcurrent) { ok = false; break; }
  (ok ? kept : dropped).push(e);
}
kept.sort((a, b) => a.st - b.st);
const sfx = new Float32Array(N), sfxFree = new Float32Array(N), bal = [];
for (const e of kept) {
  const s = loadSfx(e.f), i0 = Math.round(e.st * SR), n = Math.min(Math.round(e.dur * SR), s.x.length, N - i0);
  // level terhadap musik pada jendela yang sama (musik tanpa ducking)
  const seg = musicFree.subarray(i0, Math.min(N, i0 + Math.round(Math.max(e.act, 0.3) * SR))), mr = Math.max(-45, rmsActive(seg, 40).rms);
  const gain = 10 ** ((mr + (CAT[e.f] ?? -2) - s.rms) / 20);
  const [fi, fo] = FADE[e.f] || [0.015, Math.min(1.5, e.dur * 0.5)];
  for (let k = 0; k < n; k++) {
    const t = k / SR; let g = gain; if (t < fi) g *= t / fi; if (e.dur - t < fo) g *= Math.max(0, (e.dur - t) / fo);
    const v = s.x[k] * g; sfxFree[i0 + k] += v; sfx[i0 + k] += v * at1k(envSfx, e.st + t);
  }
  bal.push({ f: e.f, at: +e.at.toFixed(1), rmsSfx: +(s.rms + db(gain)).toFixed(1), rmsMusik: +mr.toFixed(1), selisih: +(s.rms + db(gain) - mr).toFixed(1) });
}

// ---------- 3. SATU bus reverb hall ----------
const dry = new Float32Array(N); for (let i = 0; i < N; i++) dry[i] = music[i] + sfx[i];
const dryFile = join(tmp, "dry.f32"); writeFileSync(dryFile, Buffer.from(dry.buffer));
const RT = CFG.reverb;
function makeIr(seed) {   // IR sintetis: noise yang meluruh (RT60), sedikit dihaluskan (warm), pre-delay
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; };
  const L = Math.round((RT.rt60 + RT.preDelay) * SR), ir = new Float32Array(L), pre = Math.round(RT.preDelay * SR); let lpv = 0, e = 0;
  for (let n = pre; n < L; n++) { const t = (n - pre) / SR, a = 10 ** (-3 * t / RT.rt60); lpv += 0.55 * (rnd() - lpv); ir[n] = lpv * a; }
  for (const v of ir) e += v * v; const k = 1 / Math.sqrt(e); for (let n = 0; n < L; n++) ir[n] *= k; return ir;
}
const wet = [0, 1].map((ch) => {
  const irF = join(tmp, `ir${ch}.f32`); writeFileSync(irF, Buffer.from(makeIr(1234 + ch * 777).buffer));
  const r = ff(["-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", dryFile, "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", irF, "-filter_complex", "[0:a][1:a]afir=dry=0:wet=1:gtype=none:irgain=1:length=1[o]", "-map", "[o]", "-f", "f32le", "-"]);
  if (r.status !== 0) throw new Error("afir gagal: " + r.stderr);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
});
const rms = (x) => { let e = 0; for (let i = 0; i < Math.min(N, x.length); i++) e += x[i] ** 2; return Math.sqrt(e / N); };
const wscale = rms(dry) / Math.max(rms(wet[0]), 1e-9);
const W = RT.wet, L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) { L[i] = dry[i] * (1 - W) + (wet[0][i] ?? 0) * wscale * W; R[i] = dry[i] * (1 - W) + (wet[1][i] ?? 0) * wscale * W; }
const inter = new Float32Array(N * 2); for (let i = 0; i < N; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
const raw = join(tmp, "bus.f32"); writeFileSync(raw, Buffer.from(inter.buffer));
mkdirSync("assets/mix", { recursive: true });
const enc = ff(["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", raw, "-af", "alimiter=limit=0.89:attack=5:release=120", "-ar", "48000", "-b:a", "192k", "assets/mix/bus.mp3"]);
if (enc.status !== 0) throw new Error("encode bus gagal: " + enc.stderr);

// ---------- 4. laporan ----------
const mixAll = [new Float32Array(N), new Float32Array(N)]; for (let i = 0; i < N; i++) { mixAll[0][i] = L[i] + voBus[i]; mixAll[1][i] = R[i] + voBus[i]; }
const Itot = lufs(mixAll, 0, total), master = -14 - Itot;
console.log(`Bus: musik + ${kept.length} SFX (dibuang ${dropped.length} agar maks. ${CFG.maxConcurrent} serentak), reverb hall RT60 ${RT.rt60} dtk, ${Math.round(W * 100)}% wet -> assets/mix/bus.mp3 (${total} dtk)`);
console.log(`Mix penuh (VO + bus) pra-master ${Itot} LUFS -> gain master ${master.toFixed(1)} dB (target -14 LUFS)`);
const rows = scenes.map((s) => {
  const vo = d.vo.slots.find((q) => "s" + q.scene === s.id);
  const mF = lufs([musicFree], s.start, s.end), mM = lufs([music], s.start, s.end), sx = lufs([sfx], s.start, s.end), v = lufs([voBus], s.start, s.end), mx = lufs(mixAll, s.start, s.end);
  const mv = vo ? lufs([music], vo.start + 0.3, vo.start + vo.dur - 0.3) : -99;
  return { s: s.id, dur: +(s.end - s.start).toFixed(1), musikTanpaVO: +(mF + master).toFixed(1), musikTermix: +(mM + master).toFixed(1), musikSaatVO: +(mv + master).toFixed(1), sfxSaja: +(sx + master).toFixed(1), VO: +(v + master).toFixed(1), mix: +(mx + master).toFixed(1), status: mM + master < -30 ? "GAGAL (< -30)" : "ok" };
});
console.log("\nLevel per scene setelah master -14 LUFS (LUFS): musikTanpaVO = lantai tanpa ducking; musikTermix = musik saja sebagaimana ter-mix (ducking + dip).");
console.table(rows);
console.log("Penyamaan level layer (RMS aktif, dB; selisih SFX - musik pada jendela yang sama):");
const byF = {}; for (const b of bal) (byF[b.f] ||= []).push(b.selisih);
console.table(Object.entries(byF).map(([f, a]) => ({ sfx: f, n: a.length, selisihRata2: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), min: Math.min(...a), max: Math.max(...a) })));
if (dropped.length) console.log("SFX dibuang (melebihi 2 serentak): " + dropped.map((e) => `${e.f}@${e.scene}:${e.t}`).join(", "));
// simpan metadata bus + bus musik/SFX untuk pengukuran lanjutan (scratch, tidak di-commit)
mkdirSync("build", { recursive: true });
d.audio.bus = { duration: total, sfxKept: kept.length, sfxDropped: dropped.map((e) => `${e.f}@${e.scene}:${e.t}`), masterGainDb: +master.toFixed(2), table: rows };
writeFileSync("data.json", JSON.stringify(d, null, 2) + "\n");

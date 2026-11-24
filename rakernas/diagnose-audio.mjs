#!/usr/bin/env node
// node diagnose-audio.mjs <mulai_dtk> <akhir_dtk>
// Daftar semua layer audio aktif pada jendela waktu (dari index.html): file, level di jendela, perkiraan kunci nada (chroma + profil Krumhansl),
// asal (API/sintesis), dan stem musik yang aktif (crossfade). Dipakai untuk mendiagnosis sambungan/tabrakan layer.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const FILEMODE = process.argv[2] === "--file";
const [A, B] = FILEMODE ? [0, 1] : process.argv.slice(2).map(Number);
if (!FILEMODE && !(B > A)) { console.error("pemakaian: node diagnose-audio.mjs 130 150"); process.exit(1); }
const d = JSON.parse(readFileSync("data.json", "utf8")), html = FILEMODE ? "" : readFileSync("index.html", "utf8");
const SR = 11025, NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const attr = (tag, k) => { const m = new RegExp(`${k}="([^"]*)"`).exec(tag); return m ? m[1].replace(/&quot;/g, '"') : null; };
function decode(src, from, len) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-ss", String(Math.max(0, from)), "-t", String(len), "-i", src, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2);
}
function fft(re, im) { // radix-2 in place
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = i + k + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
}
function keyOf(x) {
  const N = 4096, chroma = new Float64Array(12), re = new Float64Array(N), im = new Float64Array(N);
  for (let st = 0; st + N <= x.length; st += 2048) {
    for (let i = 0; i < N; i++) { re[i] = x[st + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) { const f = k * SR / N; if (f < 65 || f > 2000) continue; const pc = ((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12; chroma[pc] += Math.hypot(re[k], im[k]); }
  }
  const corr = (p, rot) => { const a = [...chroma].map((_, i) => chroma[(i + rot) % 12]); const ma = a.reduce((s, v) => s + v, 0) / 12, mp = p.reduce((s, v) => s + v, 0) / 12; let n = 0, da = 0, dp = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (p[i] - mp); da += (a[i] - ma) ** 2; dp += (p[i] - mp) ** 2; } return n / Math.sqrt(da * dp || 1); };
  const res = []; for (let r = 0; r < 12; r++) { res.push({ k: NAMES[r] + " mayor", r: corr(MAJ, r) }, { k: NAMES[r] + " minor", r: corr(MIN, r) }); }
  res.sort((a, b) => b.r - a.r);
  return { best: res[0].k, r: +res[0].r.toFixed(2), second: res[1].k, chroma };
}
const rmsDb = (x) => { let e = 0; for (const v of x) e += v * v; return +(10 * Math.log10(e / Math.max(1, x.length) + 1e-12)).toFixed(1); };
const lane = (pts, t) => { if (!pts) return 1; if (t <= pts[0].t) return pts[0].v; for (let i = 1; i < pts.length; i++) if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i]; return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t); } return pts[pts.length - 1].v; };
const scene = d.timing.scenes.filter((s) => s.end > A && s.start < B).map((s) => `${s.id} (${s.start}-${s.end})`).join(", ");
if (!FILEMODE) console.log(`Jendela ${A}-${B} dtk (${Math.floor(A / 60)}:${String(Math.floor(A % 60)).padStart(2, "0")}-${Math.floor(B / 60)}:${String(Math.floor(B % 60)).padStart(2, "0")}); scene: ${scene}`);
const rows = [];
for (const tag of (FILEMODE ? [] :  [...html.matchAll(/<audio\b[^>]*>/g)].map((m) => m[0]))) {
  const id = attr(tag, "id"), src = attr(tag, "src"), st = +attr(tag, "data-start"), dur = +attr(tag, "data-duration");
  if (st >= B || st + dur <= A) continue;
  const au = attr(tag, "data-automation"), pts = au ? JSON.parse(au).lanes[0].points : null, vol = +(attr(tag, "data-volume") ?? 1);
  const lo = Math.max(A, st) - st, len = Math.min(B, st + dur) - Math.max(A, st);
  const x = decode(src, lo, len), mid = (Math.max(A, st) + Math.min(B, st + dur)) / 2 - st;
  const k = keyOf(x), tonal = k.r >= 0.6;
  rows.push({ id, src, start: +st.toFixed(2), end: +(st + dur).toFixed(2), gain: +(vol * lane(pts, mid)).toFixed(3), rmsMentah: rmsDb(x), rmsMix: +(rmsDb(x) + 20 * Math.log10(vol * lane(pts, mid) + 1e-9)).toFixed(1), kunci: tonal ? `${k.best} (r=${k.r})` : `tak-tonal (${k.best}, r=${k.r})`, asal: /\/sfx\//.test(src) ? (/\.wav$/.test(src) ? "sintesis FFmpeg (placeholder)" : "ElevenLabs Sound Effects API") : /\/music\//.test(src) ? "bed musik (gabungan stem API)" : "ElevenLabs TTS" });
}
if (!FILEMODE) console.table(rows);
// kunci bed per 5 dtk + posisi sambungan stem
const bed = rows.find((r) => /\/music\//.test(r.src));
if (bed && d.audio.musicStems) {
  const XF = d.elevenlabs.music.crossfade, step = d.elevenlabs.music.stemSeconds - XF;
  console.log(`Stem bed (acrossfade ${XF} dtk, tiap ${step} dtk):`);
  d.audio.musicStems.forEach((s, i) => { const a = i * step, b = a + d.elevenlabs.music.stemSeconds; if (b > A && a < B) console.log(`  stem ${i + 1}: ${s.split("/").pop()}  ${a}-${b} dtk${i > 0 ? `  (sambungan crossfade ${a}-${a + XF})` : ""}`); });
  for (let t = Math.floor(A / 5) * 5; t < B; t += 5) { const x = decode(bed.src, t, 5), k = keyOf(x); console.log(`  bed ${t}-${t + 5} dtk: kunci ${k.best} (r=${k.r}, kedua ${k.second})`); }
}

if (FILEMODE) {
  // node diagnose-audio.mjs --file assets/music/bgm-main.mp3 [lebar_dtk]: kunci nada per jendela (cek konsistensi kunci)
  const f = process.argv[3], w = +(process.argv[4] || 15);
  const dur = parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);
  const keys = {};
  for (let t = 0; t < dur - w / 2; t += w) { const x = decode(f, t, w), k = keyOf(x); keys[k.best] = (keys[k.best] || 0) + 1; console.log(`  ${String(t).padStart(3)}-${Math.min(dur, t + w).toFixed(0).padStart(3)} dtk: ${k.best} (r=${k.r}, kedua ${k.second}), RMS ${rmsDb(x)} dB`); }
  console.log("Distribusi kunci:", JSON.stringify(keys));
}

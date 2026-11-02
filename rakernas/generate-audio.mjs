#!/usr/bin/env node
// generate-audio.mjs - VO, SFX dan musik Rakernas lewat API ElevenLabs.
//
//   node generate-audio.mjs                 # semua: VO -> sinkron timing -> SFX -> musik
//   node generate-audio.mjs --only=vo       # hanya VO (atau: sfx, music; boleh dipisah koma)
//   node generate-audio.mjs --dry           # tampilkan naskah hasil render template + jumlah karakter; TIDAK memanggil API
//   node generate-audio.mjs --force         # buat ulang SFX/musik yang filenya sudah ada (VO selalu dibuat ulang)
//
// Setelah selesai jalankan: node build.mjs
//
// Aturan: ELEVENLABS_API_KEY dibaca dari rakernas/.env (atau environment). Key tidak pernah dicetak.
// Bila API tidak bisa dijangkau / key tidak ada / key ditolak, skrip BERHENTI dengan pesan jelas dan
// tidak menyentuh file audio maupun data.json (tidak ada audio palsu).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { numWords } from "./lib/numwords.mjs";

process.chdir(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const DRY = args.includes("--dry"), FORCE = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice(7).split(",") : null;
const want = (k) => !ONLY || ONLY.includes(k);
const die = (msg, code = 1) => { console.error("\n[generate-audio] " + msg + "\n"); process.exit(code); };

// ---------- konfigurasi ----------
const data = JSON.parse(readFileSync("data.json", "utf8"));
const EL = {
  voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel - Steady Broadcaster (pria, formal, ala penyiar)",
  modelId: "eleven_multilingual_v2", languageCode: "id",
  stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1.0, useSpeakerBoost: true,
  outputFormat: "mp3_44100_128", gapAfterVo: 1.0,
  ...(data.elevenlabs || {}),
};

function loadEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
loadEnv();

// ---------- render template vo.txt ----------
const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), data);
function renderExpr(expr) {
  let m;
  if ((m = /^dir:([\w.]+)\|([^|]*)\|([^|]*)$/.exec(expr))) {
    const e = get(m[1]); if (!e) throw new Error(`data.json tidak punya "${m[1]}"`);
    return e.after < e.before ? m[2] : m[3];
  }
  if ((m = /^txt:([\w.]+)$/.exec(expr))) {
    const v = get(m[1]); if (v == null) throw new Error(`data.json tidak punya "${m[1]}"`);
    return String(v).replace(/\s*&\s*/g, " and ");
  }
  if ((m = /^([\w.]+?)(?:\+(\d+))?$/.exec(expr))) {
    const raw = get(m[1]); if (raw == null) throw new Error(`data.json tidak punya "${m[1]}"`);
    const num = parseFloat(String(raw).replace(",", ".")); if (Number.isNaN(num)) throw new Error(`"${m[1]}" bukan angka: ${raw}`);
    const total = num + (m[2] ? +m[2] : 0);
    // pertahankan desimal asli (8.0 tetap "delapan", 3.8 -> "tiga koma delapan")
    return numWords(Number.isInteger(total) ? total : String(total));
  }
  throw new Error(`ekspresi tidak dikenal: {{${expr}}}`);
}

function parseVo() {
  const lines = readFileSync("vo.txt", "utf8").split(/\r?\n/);
  const pron = [], scenes = [];
  let mode = null, cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^\[PRONUNCIATION\]/i.test(line)) { mode = "pron"; continue; }
    const h = /^\[SCENE\s+(\d+)([^\]]*)\]/i.exec(line);
    if (h) {
      cur = { n: +h[1], lead: 1, min: 6, tpl: "" };
      for (const kv of h[2].split("|")) { const m = /(\w+)\s*=\s*([\d.]+)/.exec(kv); if (m) cur[m[1]] = +m[2]; }
      scenes.push(cur); mode = "scene"; continue;
    }
    if (mode === "pron") { const m = /^(.+?)\s*=\s*(.+)$/.exec(line); if (m) pron.push([m[1].trim(), m[2].trim()]); }
    else if (mode === "scene" && cur) cur.tpl += (cur.tpl ? " " : "") + line;
  }
  return { pron, scenes };
}

function renderScene(sc, pron) {
  let text = sc.tpl.replace(/\{\{([^}]+)\}\}/g, (_, e) => renderExpr(e.trim()));
  // teks tampil (tanpa penanda) disimpan untuk speaker-notes; teks ucap memakai fonetik
  const display = text.replace(/\[\[\w+\]\]/g, "").replace(/\s+/g, " ").trim();
  for (const [from, to] of pron) text = text.replace(new RegExp(`(?<![A-Za-z])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "g"), to);
  const markers = []; let clean = "";
  for (const part of text.split(/(\[\[\w+\]\])/)) {
    const m = /^\[\[(\w+)\]\]$/.exec(part);
    if (m) markers.push({ name: m[1], pos: clean.length }); else clean += part;
  }
  clean = clean.replace(/\s+/g, (s, off) => { return " "; });
  return { n: sc.n, lead: sc.lead, min: sc.min, display, clean, markers };
}

const vo = parseVo();
const SCENES = vo.scenes.map((s) => renderScene(s, vo.pron)).sort((a, b) => a.n - b.n);
if (SCENES.length !== 8) die(`vo.txt harus berisi 8 scene, ditemukan ${SCENES.length}.`);
// marker dihitung terhadap teks sebelum normalisasi spasi; hitung ulang dari clean yang dikirim
for (const s of SCENES) {
  // posisi marker dipetakan ulang: hapus spasi ganda tidak mengubah panjang karena template sudah satu spasi
  s.chars = s.clean.length;
}
const totalChars = SCENES.reduce((a, s) => a + s.chars, 0);

if (DRY) {
  console.log(`Mode --dry: tidak ada panggilan API.\nVoice: ${EL.voiceName} (${EL.voiceId}) | model ${EL.modelId}\n`);
  for (const s of SCENES) {
    console.log(`SCENE ${s.n} (${s.chars} karakter, lead ${s.lead}s, min ${s.min}s)\n  ucap : ${s.clean}\n  marker: ${s.markers.map((m) => m.name + "@" + m.pos).join(", ") || "-"}\n`);
  }
  console.log(`Total karakter TTS: ${totalChars}`);
  process.exit(0);
}

// ---------- HTTP via curl (ikut proxy/CA environment; key lewat stdin, tidak tampil di daftar proses) ----------
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) die("ELEVENLABS_API_KEY tidak ditemukan (rakernas/.env atau environment). Dihentikan; tidak ada audio dibuat.");
const tmp = mkdtempSync(join(tmpdir(), "rk-audio-"));
process.on("exit", () => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });
let seq = 0;
function api(method, path, body) {
  const out = join(tmp, `resp-${++seq}.bin`);
  let cfg = `url = "https://api.elevenlabs.io${path}"\nrequest = "${method}"\nheader = "xi-api-key: ${KEY}"\nwrite-out = "%{http_code}"\noutput = "${out}"\n`;
  if (body !== undefined) {
    const bf = join(tmp, `body-${seq}.json`); writeFileSync(bf, JSON.stringify(body));
    cfg += `header = "Content-Type: application/json"\ndata-binary = "@${bf}"\n`;
  }
  const r = spawnSync("curl", ["-sS", "--max-time", "240", "-K", "-"], { input: cfg, encoding: "utf8" });
  const status = parseInt(r.stdout, 10) || 0;
  const buf = existsSync(out) ? readFileSync(out) : Buffer.alloc(0);
  const err = (r.stderr || "").replace(KEY, "***").trim();
  return { status, buf, err, netFail: r.status !== 0 || status === 0 };
}
const detail = (r) => { try { const j = JSON.parse(r.buf.toString("utf8")); const d = j.detail || j; return typeof d === "string" ? d : d.message || d.status || JSON.stringify(d); } catch { return r.buf.toString("utf8").slice(0, 200); } };

// preflight
let usageBefore = null;
{
  const r = api("GET", "/v1/user/subscription");
  if (r.netFail) die(`API ElevenLabs tidak bisa dijangkau (api.elevenlabs.io:443 ditolak/terblokir): ${r.err || "tidak ada respons"}\nDihentikan; tidak ada audio dibuat dan file proyek tidak diubah.\nIzinkan host api.elevenlabs.io di pengaturan jaringan environment, lalu jalankan ulang.`, 2);
  if (r.status === 401 && /invalid_api_key|invalid/i.test(detail(r))) die("ELEVENLABS_API_KEY ditolak oleh ElevenLabs (key tidak valid). Dihentikan.", 3);
  if (r.status === 200) { try { usageBefore = JSON.parse(r.buf.toString("utf8")); } catch {} }
  else if (r.status !== 401) die(`Pengecekan API gagal (HTTP ${r.status}): ${detail(r)}`, 3);
  else {
    const m = api("GET", "/v1/models");
    if (m.status !== 200) die(`ELEVENLABS_API_KEY tidak bisa dipakai (HTTP ${m.status}): ${detail(m)}`, 3);
  }
}
if (usageBefore) console.log(`Paket ElevenLabs: ${usageBefore.tier} | kredit terpakai ${usageBefore.character_count}/${usageBefore.character_limit}`);
if (usageBefore && want("vo") && usageBefore.character_limit - usageBefore.character_count < totalChars)
  die(`Kuota karakter tidak cukup: perlu ~${totalChars}, sisa ${usageBefore.character_limit - usageBefore.character_count}.`, 4);

const ffprobeDur = (f) => parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);
function analyze(file) {
  const dur = ffprobeDur(file);
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "8000", "-"], { maxBuffer: 1 << 29 });
  const b = r.stdout, W = 160; let best = -1, at = 0;
  for (let i = 0; i + W * 2 <= b.length; i += W * 2) {
    let e = 0; for (let j = 0; j < W; j++) { const v = b.readInt16LE(i + j * 2); e += v * v; }
    if (e > best) { best = e; at = i / 2 / 8000; }
  }
  return { dur: +dur.toFixed(3), peak: +at.toFixed(2) };
}

// ---------- 1. VOICE OVER ----------
const audio = data.audio || (data.audio = {});
const sceneId = (n) => "s" + n;
if (want("vo")) {
  mkdirSync("assets/vo", { recursive: true });
  const voDur = {}, cuesVo = {};
  for (const s of SCENES) {
    process.stdout.write(`VO scene ${s.n}: ${s.chars} karakter ... `);
    const prev = SCENES.find((x) => x.n === s.n - 1), next = SCENES.find((x) => x.n === s.n + 1);
    const body = {
      text: s.clean, model_id: EL.modelId,
      voice_settings: { stability: EL.stability, similarity_boost: EL.similarityBoost, style: EL.style, use_speaker_boost: EL.useSpeakerBoost, speed: EL.speed },
    };
    if (prev) body.previous_text = prev.clean.slice(-200);
    if (next) body.next_text = next.clean.slice(0, 200);
    if (EL.languageCode && /v2_5|flash|turbo/.test(EL.modelId)) body.language_code = EL.languageCode; // multilingual_v2 mendeteksi bahasa dari teks
    const r = api("POST", `/v1/text-to-speech/${EL.voiceId}/with-timestamps?output_format=${EL.outputFormat}`, body);
    if (r.netFail || r.status !== 200) die(`TTS scene ${s.n} gagal (HTTP ${r.status}): ${r.netFail ? r.err : detail(r)}\nScene sebelumnya mungkin sudah tertulis; data.json belum diubah.`, 5);
    const j = JSON.parse(r.buf.toString("utf8"));
    const file = `assets/vo/scene${s.n}.mp3`;
    writeFileSync(file, Buffer.from(j.audio_base64, "base64"));
    const dur = ffprobeDur(file); voDur[sceneId(s.n)] = +dur.toFixed(3);
    const al = j.alignment || j.normalized_alignment, A = al.characters.join("");
    const st = al.character_start_times_seconds, en = al.character_end_times_seconds;
    const cues = {};
    for (const mk of s.markers) {
      let p = A.length === s.clean.length ? mk.pos : Math.round((mk.pos / s.clean.length) * A.length);
      while (p < A.length - 1 && /\s/.test(A[p])) p++;
      cues[mk.name] = +Math.min(st[Math.min(p, st.length - 1)], dur).toFixed(3);
    }
    cues.end = +Math.max(en[en.length - 1], dur - 0.05).toFixed(3);
    cuesVo[sceneId(s.n)] = cues;
    console.log(`${dur.toFixed(2)} dtk, cue: ${Object.entries(cues).map(([k, v]) => k + "=" + v).join(" ")}`);
  }
  // timing: durasi scene = max(min animasi, lead + VO + jeda)
  let t = 0; const scenes = [], dur = {}, lead = {}, cues = {}, script = {}, slots = [];
  for (const s of SCENES) {
    const id = sceneId(s.n), d = +Math.max(s.min, s.lead + voDur[id] + EL.gapAfterVo).toFixed(2);
    scenes.push({ id, start: +t.toFixed(2), end: +(t + d).toFixed(2) });
    dur[id] = d; lead[id] = s.lead; script[id] = s.display;
    cues[id] = Object.fromEntries(Object.entries(cuesVo[id]).map(([k, v]) => [k, +(v + s.lead).toFixed(3)]));
    slots.push({ scene: s.n, file: `assets/vo/scene${s.n}.mp3`, start: +(t + s.lead).toFixed(3), dur: voDur[id] });
    t += d;
  }
  data.timing.scenes = scenes; data.timing.total = +t.toFixed(2); data.timing.flashAt = scenes.slice(0, -1).map((x) => x.end);
  data.vo.slots = slots;
  Object.assign(audio, { generated: true, lead, dur, voDur, cues, script,
    chars: { vo: totalChars }, voice: { id: EL.voiceId, name: EL.voiceName, model: EL.modelId } });
  data.elevenlabs = { ...EL };
  writeFileSync("data.json", JSON.stringify(data, null, 2) + "\n");
  console.log(`\nTiming baru: total ${data.timing.total} dtk -> ` + scenes.map((x) => `${x.id} ${x.start}-${x.end}`).join(", "));
} else if (!audio.generated) {
  die("Timing scene belum ada: jalankan VO dulu (tanpa --only, atau --only=vo) sebelum SFX/musik.");
}

// ---------- 2. SOUND EFFECTS ----------
const SFX = data.elevenlabs?.sfx || EL.sfx || [
  { name: "opening-hit", duration: 6, prompt: "epic cinematic orchestral hit, deep sub boom, brass stab, cymbal swell, long reverb tail" },
  { name: "initiatives-2027-hit", duration: 5, prompt: "heroic cinematic impact with rising shimmer" },
  { name: "whoosh", duration: 1.2, prompt: "smooth cinematic whoosh transition, short airy sweep" },
  { name: "riser", duration: 3, prompt: "cinematic tension riser building to a hit, rising synth and noise swell" },
  { name: "chime", duration: 1.5, prompt: "soft bright positive success chime, single glassy bell with gentle shimmer" },
  { name: "logo-swell", duration: 5, prompt: "uplifting cinematic logo reveal swell, warm rising pad with shimmer resolving gently" },
];
audio.sources = audio.sources || { sfx: {}, music: {} };
data.sfx.files = data.sfx.files || {};
const notes = [];
if (want("sfx")) {
  mkdirSync("assets/sfx", { recursive: true });
  for (const x of SFX) {
    const file = `assets/sfx/${x.name}.mp3`;
    if (existsSync(file) && !FORCE && audio.sources.sfx[x.name] === "elevenlabs") { console.log(`SFX ${x.name}: sudah ada (lewati; --force untuk ulang)`); continue; }
    process.stdout.write(`SFX ${x.name} (${x.duration} dtk) ... `);
    const r = api("POST", `/v1/sound-generation?output_format=${EL.outputFormat}`, { text: x.prompt, duration_seconds: x.duration, prompt_influence: 0.5 });
    if (r.netFail || r.status !== 200) {
      const why = r.netFail ? r.err : `HTTP ${r.status}: ${detail(r)}`;
      console.log("GAGAL -> tetap placeholder sintetis (" + why + ")");
      audio.sources.sfx[x.name] = "placeholder"; notes.push(`SFX ${x.name}: ${why}`); continue;
    }
    writeFileSync(file, r.buf);
    data.sfx.files[x.name] = { file: `${x.name}.mp3`, ...analyze(file) };
    audio.sources.sfx[x.name] = "elevenlabs";
    console.log(`ok (${data.sfx.files[x.name].dur} dtk, puncak ${data.sfx.files[x.name].peak} dtk)`);
  }
  audio.chars = { ...(audio.chars || {}), sfxSeconds: SFX.filter((x) => audio.sources.sfx[x.name] === "elevenlabs").reduce((a, x) => a + x.duration, 0) };
}

// ---------- 3. MUSIK ----------
const sceneSpan = (ids) => { const a = data.timing.scenes.filter((s) => ids.includes(s.id)); return a[a.length - 1].end - a[0].start; };
const MUSIC = data.elevenlabs?.music || EL.music || [
  { name: "bgm-opening", scenes: ["s1", "s2"], prompt: "instrumental cinematic epic build, no vocals, slow rising strings and low percussion, dark and powerful, gradual crescendo" },
  { name: "bgm-achievement", scenes: ["s3", "s4", "s5"], prompt: "instrumental corporate inspiring background music, 95 BPM, no vocals, soft pulsing synth and light piano, no dominant melody, leaves room for a voice-over, steady and optimistic" },
  { name: "bgm-2027", scenes: ["s6", "s7", "s8"], prompt: "instrumental heroic cinematic music, no vocals, triumphant brass and strings, builds steadily to a powerful climax, uplifting and ambitious" },
];
if (want("music")) {
  mkdirSync("assets/music", { recursive: true });
  for (const m of MUSIC) {
    const file = `assets/music/${m.name}.mp3`;
    if (existsSync(file) && !FORCE && audio.sources.music[m.name] === "elevenlabs") { console.log(`Musik ${m.name}: sudah ada (lewati; --force untuk ulang)`); continue; }
    const len = Math.min(600, Math.max(10, Math.ceil(sceneSpan(m.scenes) + 2)));
    process.stdout.write(`Musik ${m.name} (${len} dtk) ... `);
    const r = api("POST", `/v1/music?output_format=${EL.outputFormat}`, { prompt: m.prompt, music_length_ms: len * 1000, force_instrumental: true, model_id: "music_v1" });
    if (r.netFail || r.status !== 200) {
      const why = r.netFail ? r.err : `HTTP ${r.status}: ${detail(r)}`;
      console.log("GAGAL -> tetap placeholder (" + why + ")");
      audio.sources.music[m.name] = "placeholder"; notes.push(`Musik ${m.name}: ${why}`); continue;
    }
    writeFileSync(file, r.buf);
    audio.sources.music[m.name] = "elevenlabs";
    audio.musicDur = { ...(audio.musicDur || {}), [m.name]: +ffprobeDur(file).toFixed(2) };
    console.log("ok " + audio.musicDur[m.name] + " dtk");
  }
}
data.elevenlabs = { ...EL, sfx: SFX, music: MUSIC };
audio.notes = notes;
writeFileSync("data.json", JSON.stringify(data, null, 2) + "\n");

// ---------- laporan pemakaian ----------
const after = api("GET", "/v1/user/subscription");
if (after.status === 200 && usageBefore) {
  const u = JSON.parse(after.buf.toString("utf8"));
  console.log(`\nPemakaian kredit run ini: ${u.character_count - usageBefore.character_count} (sisa ${u.character_limit - u.character_count} dari ${u.character_limit})`);
}
console.log(`Karakter VO: ${totalChars}. Selesai - jalankan: node build.mjs`);
if (notes.length) console.log("\nCatatan (masih placeholder):\n - " + notes.join("\n - "));

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
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
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
const scArg = args.find((a) => a.startsWith("--scenes="));
const SCENE_SET = scArg ? scArg.slice(9).split(",").map(Number) : null;   // generate VO hanya scene ini (hemat kredit); scene lain dipakai apa adanya
const want = (k) => !ONLY || ONLY.includes(k);
const die = (msg, code = 1) => { console.error("\n[generate-audio] " + msg + "\n"); process.exit(code); };

// ---------- konfigurasi ----------
const data = JSON.parse(readFileSync("data.json", "utf8"));
const V = data.voice || {};
const EL = {
  modelId: "eleven_multilingual_v2", languageCode: "id", outputFormat: "mp3_44100_128", gapAfterVo: 0.4,
  ...(data.elevenlabs || {}),
  voiceId: V.id, voiceName: V.name || V.id, speed: V.speed ?? 0.95,
  stability: V.stability ?? 0.65, similarityBoost: V.similarityBoost ?? 0.75, style: V.style ?? 0.1, useSpeakerBoost: V.speakerBoost ?? true,
};
const needVoice = !args.includes("--dry") && (want("vo") || args.includes("--voice-test") || args.includes("--test-pron"));
if (needVoice && !EL.voiceId) die("data.json > voice.id kosong. Isi voice.id (dan voice.speed) dulu; skrip tidak memilih suara sendiri.");

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
  if ((m = /^([\w.]+?)(?:\+(\d+))?(?:\|d(\d+))?$/.exec(expr))) {
    const raw = get(m[1]); if (raw == null) throw new Error(`data.json tidak punya "${m[1]}"`);
    const num = parseFloat(String(raw).replace(",", ".")); if (Number.isNaN(num)) throw new Error(`"${m[1]}" bukan angka: ${raw}`);
    const total = num + (m[2] ? +m[2] : 0);
    // pertahankan desimal asli (8.0 tetap "delapan", 3.8 -> "tiga koma delapan")
    if (m[3] !== undefined) return numWords(total.toFixed(+m[3]));
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
function api(method, path, body, form) {
  const out = join(tmp, `resp-${++seq}.bin`);
  let cfg = `url = "https://api.elevenlabs.io${path}"\nrequest = "${method}"\nheader = "xi-api-key: ${KEY}"\nwrite-out = "%{http_code}"\noutput = "${out}"\n`;
  if (body !== undefined) {
    const bf = join(tmp, `body-${seq}.json`); writeFileSync(bf, JSON.stringify(body));
    cfg += `header = "Content-Type: application/json"\ndata-binary = "@${bf}"\n`;
  }
  if (form) for (const f of form) cfg += `form = "${f}"\n`;
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
const needChars = SCENE_SET ? SCENES.filter((x) => SCENE_SET.includes(x.n)).reduce((a, x) => a + x.chars, 0) : totalChars;
if (usageBefore && want("vo") && usageBefore.character_limit - usageBefore.character_count < needChars)
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

// ---------- pronunciation dictionary (alias rules) ----------
// data.json > elevenlabs.pronunciation = [{ from: "Wo", alias: "..." }]. Dibuat ulang hanya bila aturan berubah (hash).
import { createHash } from "node:crypto";
function ensureDictionary() {
  const rules = EL.pronunciation || [];
  if (!rules.length) return [];
  const hash = createHash("sha1").update(JSON.stringify(rules)).digest("hex").slice(0, 10);
  if (EL.dictionary?.hash === hash && EL.dictionary.id) return [{ pronunciation_dictionary_id: EL.dictionary.id, version_id: EL.dictionary.versionId }];
  const r = api("POST", "/v1/pronunciation-dictionaries/add-from-rules", {
    name: `rakernas-${hash}`, description: "Rakernas: pelafalan Wo / Lor",
    rules: rules.map((x) => ({ type: "alias", string_to_replace: x.from, alias: x.alias, case_sensitive: true, word_boundaries: true })),
  });
  if (r.status !== 200) { console.warn(`PERINGATAN: pronunciation dictionary gagal (HTTP ${r.status}: ${detail(r)}); lanjut tanpa dictionary.`); EL.dictionaryError = detail(r); return []; }
  const j = JSON.parse(r.buf.toString("utf8"));
  EL.dictionary = { id: j.id, versionId: j.version_id, hash };
  console.log(`Pronunciation dictionary dibuat: ${j.id} (${rules.map((x) => x.from + "->" + x.alias).join(", ")})`);
  return [{ pronunciation_dictionary_id: j.id, version_id: j.version_id }];
}
const voiceSettings = () => ({ stability: EL.stability, similarity_boost: EL.similarityBoost, style: EL.style, use_speaker_boost: EL.useSpeakerBoost, speed: EL.speed });

// ---------- uji pelafalan: node generate-audio.mjs --test-pron ----------
// Membuat cuplikan pendek, lalu mentranskripsi balik dengan ElevenLabs Speech-to-Text untuk memeriksa apakah kata terbaca sebagai KATA (bukan dieja).
if (args.includes("--test-pron")) {
  const tests = JSON.parse(readFileSync("pron-tests.json", "utf8"));
  for (const t of tests) {
    const text = t.text, locs = t.dict ? [{ pronunciation_dictionary_id: t.dict.id, version_id: t.dict.versionId }] : [];
    let loc = locs;
    if (t.rules) { // dictionary sementara untuk uji
      const d = api("POST", "/v1/pronunciation-dictionaries/add-from-rules", { name: "rk-test-" + Date.now() % 100000, rules: t.rules.map((x) => ({ type: "alias", string_to_replace: x.from, alias: x.alias, case_sensitive: true, word_boundaries: true })) });
      if (d.status === 200) { const j = JSON.parse(d.buf.toString("utf8")); loc = [{ pronunciation_dictionary_id: j.id, version_id: j.version_id }]; } else { console.log(`  (dictionary uji gagal: ${detail(d)})`); }
    }
    const body = { text, model_id: EL.modelId, voice_settings: voiceSettings() };
    if (loc.length) body.pronunciation_dictionary_locators = loc;
    const r = api("POST", `/v1/text-to-speech/${EL.voiceId}?output_format=${EL.outputFormat}`, body);
    if (r.status !== 200) { console.log(`[${t.id}] TTS gagal: ${detail(r)}`); continue; }
    const f = join(tmp, `${t.id}.mp3`); writeFileSync(f, r.buf);
    const st = api("POST", "/v1/speech-to-text", undefined, [`file=@${f}`, "model_id=scribe_v1", "tag_audio_events=false"]);
    let tr = st.status === 200 ? JSON.parse(st.buf.toString("utf8")).text : `(STT gagal HTTP ${st.status}: ${detail(st)})`;
    console.log(`[${t.id}] ${text.length} karakter | ${ffprobeDur(f).toFixed(2)} dtk | dict: ${t.rules ? t.rules.map((x) => x.from + "->" + x.alias).join(",") : "-"}\n   kirim : ${text}\n   dengar: ${tr}`);
  }
  process.exit(0);
}

const saveEL = () => { const { voiceId, voiceName, speed, stability, similarityBoost, style, useSpeakerBoost, ...rest } = EL; return rest; };

// ---------- pasca-proses suara narator (halus; TANPA pitch shift) ----------
// high-pass 70 Hz, low-shelf (+dB sekitar 150 Hz) untuk nada lebih dalam, de-esser ringan, kompresor lembut.
function postVo(inp, out) {
  const P = data.voice?.post || {};
  const de = P.deEsser || {}, cp = P.compressor || {};
  const chain = [
    `highpass=f=${P.highpassHz ?? 70}`,
    `bass=g=${P.lowShelfDb ?? 2.5}:f=${P.lowShelfHz ?? 150}:w=0.7`,
    `deesser=i=${de.intensity ?? 0.3}:m=${de.maxReduction ?? 0.5}:f=${de.freq ?? 0.5}`,
    `acompressor=threshold=${(10 ** ((cp.thresholdDb ?? -18) / 20)).toFixed(4)}:ratio=${cp.ratio ?? 2}:attack=${cp.attackMs ?? 20}:release=${cp.releaseMs ?? 250}:makeup=${(10 ** ((cp.makeupDb ?? 1.5) / 20)).toFixed(3)}`,
    "alimiter=limit=0.95",
  ].join(",");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", inp, "-af", chain, "-ar", "44100", "-b:a", "192k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("pasca-proses VO gagal: " + r.stderr);
}

// ---------- cuplikan uji suara: node generate-audio.mjs --voice-test ----------
// Dua kalimat (S1 + satu kalimat S3 berisi WO dan Lor) -> preview/voice-test.mp3 (sudah lewat pasca-proses). Tidak menyentuh VO scene.
if (args.includes("--voice-test")) {
  const vt = JSON.parse(readFileSync("voice-test.json", "utf8"));
  const sc = vo.scenes.map((x) => ({ n: x.n, tpl: x.tpl }));
  const pick = (n, from, to) => { const tpl = sc.find((x) => x.n === n).tpl; return tpl; };
  const rendered = [renderScene({ ...vo.scenes.find((x) => x.n === 1) }, vo.pron).clean, renderScene({ n: 3, lead: 0, min: 0, tpl: vt.s3Sentence }, vo.pron).clean];
  const text = rendered.join(" ");
  const locators = ensureDictionary();
  const body = { text, model_id: EL.modelId, voice_settings: voiceSettings() };
  if (locators.length) body.pronunciation_dictionary_locators = locators;
  const r = api("POST", `/v1/text-to-speech/${EL.voiceId}?output_format=${EL.outputFormat}`, body);
  if (r.status !== 200) die(`Uji suara gagal (HTTP ${r.status}): ${detail(r)}\nSuara ${EL.voiceId}: bila ini suara library, paket free tidak bisa memakainya lewat API.`, 7);
  mkdirSync("preview", { recursive: true });
  const rawf = join(tmp, "voice-test-raw.mp3"); writeFileSync(rawf, r.buf);
  postVo(rawf, "preview/voice-test.mp3");
  const st = api("POST", "/v1/speech-to-text", undefined, [`file=@preview/voice-test.mp3`, "model_id=scribe_v1", "tag_audio_events=false"]);
  console.log(`preview/voice-test.mp3: ${ffprobeDur("preview/voice-test.mp3").toFixed(2)} dtk, ${text.length} karakter, voice ${EL.voiceId}, speed ${EL.speed}, stability ${EL.stability}, similarity ${EL.similarityBoost}, style ${EL.style}`);
  console.log(`  teks dikirim: ${text}`);
  console.log(`  transkripsi : ${st.status === 200 ? JSON.parse(st.buf.toString("utf8")).text : "(STT gagal)"}`);
  process.exit(0);
}

// ---------- samakan level antar klip VO (gain per slot, +-4 dB maks) ----------
function measureLufs(f) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
  const sum = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  return parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(sum)[1]);
}
function equalizeVo() {
  const L = data.vo.slots.map((x) => measureLufs(x.file));
  const target = [...L].sort((a, b) => a - b)[Math.floor(L.length / 2)];
  data.vo.slots.forEach((x, i) => { x.lufs = L[i]; x.gain = +Math.min(1.58, Math.max(0.63, 10 ** ((target - L[i]) / 20))).toFixed(3); });
  data.audio.voLufsTarget = target;
  console.log("Level VO per scene (LUFS) -> gain: " + data.vo.slots.map((x) => `s${x.scene} ${x.lufs} (x${x.gain})`).join(", "));
}

// ---------- 1. VOICE OVER ----------
const audio = data.audio || (data.audio = {});
const sceneId = (n) => "s" + n;
if (want("vo")) {
  mkdirSync("assets/vo", { recursive: true });
  const voDur = {}, cuesVo = {};
  const locators = ensureDictionary();
  for (const s of SCENES) {
    if (SCENE_SET && !SCENE_SET.includes(s.n)) {
      // scene tidak digenerate ulang: pakai durasi + cue yang sudah tersimpan (cue tersimpan = cue VO + lead)
      const id = sceneId(s.n);
      voDur[id] = audio.voDur[id];
      cuesVo[id] = Object.fromEntries(Object.entries(audio.cues[id]).map(([k, v]) => [k, +(v - audio.lead[id]).toFixed(3)]));
      console.log(`VO scene ${s.n}: dilewati (tetap file lama, ${voDur[id]} dtk)`);
      continue;
    }
    process.stdout.write(`VO scene ${s.n}: ${s.chars} karakter ... `);
    const prev = SCENES.find((x) => x.n === s.n - 1), next = SCENES.find((x) => x.n === s.n + 1);
    const body = {
      text: s.clean, model_id: EL.modelId,
      voice_settings: voiceSettings(),
    };
    if (locators.length) body.pronunciation_dictionary_locators = locators;
    // request stitching: konteks scene sebelum/sesudah agar intonasi menyambung
    if (prev) body.previous_text = prev.clean.slice(-300);
    if (next) body.next_text = next.clean.slice(0, 300);
    if (EL.languageCode && /v2_5|flash|turbo/.test(EL.modelId)) body.language_code = EL.languageCode; // multilingual_v2 mendeteksi bahasa dari teks
    const r = api("POST", `/v1/text-to-speech/${EL.voiceId}/with-timestamps?output_format=${EL.outputFormat}`, body);
    if (r.netFail || r.status !== 200) die(`TTS scene ${s.n} gagal (HTTP ${r.status}): ${r.netFail ? r.err : detail(r)}\nScene sebelumnya mungkin sudah tertulis; data.json belum diubah.`, 5);
    const j = JSON.parse(r.buf.toString("utf8"));
    const file = `assets/vo/scene${s.n}.mp3`, rawFile = `assets/vo/raw/scene${s.n}.mp3`;
    mkdirSync("assets/vo/raw", { recursive: true });
    writeFileSync(rawFile, Buffer.from(j.audio_base64, "base64"));
    postVo(rawFile, file);   // pasca-proses halus; durasi tidak berubah (tanpa pitch/tempo)
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
  equalizeVo();
  data.elevenlabs = saveEL();
  writeFileSync("data.json", JSON.stringify(data, null, 2) + "\n");
  console.log(`\nTiming baru: total ${data.timing.total} dtk -> ` + scenes.map((x) => `${x.id} ${x.start}-${x.end}`).join(", "));
} else if (want("vogain") && audio.generated) {
  equalizeVo(); writeFileSync("data.json", JSON.stringify(data, null, 2) + "\n");
} else if (!audio.generated) {
  die("Timing scene belum ada: jalankan VO dulu (tanpa --only, atau --only=vo) sebelum SFX/musik.");
}

// ---------- 2. SOUND EFFECTS ----------
// Mentah dari API disimpan di assets/sfx/raw/NAMA.mp3 (tidak dibuat ulang bila sudah ada); versi olahan (fade in singkat,
// reverb + ekor panjang untuk hit besar) ditulis ke assets/sfx/NAMA.mp3 dan itu yang dipakai timeline.
const SFX = EL.sfx;
const TAIL = { "opening-hit": 2.5, "initiatives-2027-hit": 2.5, "logo-swell": 2.0, chime: 1.0, whoosh: 0.4, riser: 0 };
const REVERB = { "opening-hit": "0.8:0.6:90|180|330|520:0.35|0.28|0.2|0.12", "initiatives-2027-hit": "0.8:0.6:90|180|330|520:0.35|0.28|0.2|0.12", "logo-swell": "0.8:0.6:120|260|420:0.3|0.22|0.14", chime: "0.8:0.6:70|150:0.25|0.15" };
audio.sources = audio.sources || { sfx: {}, music: {} };
audio.sources.music = audio.sources.music || {};
data.sfx.files = data.sfx.files || {};
const notes = [];
function processSfx(name, raw, out) {
  const rawDur = ffprobeDur(raw), tail = TAIL[name] ?? 0.5, total = rawDur + tail;
  const fo = Math.min(total, tail + 0.9);
  const chain = ["afade=t=in:d=0.012:curve=qsin", tail > 0 ? `apad=pad_dur=${tail}` : null, REVERB[name] ? `aecho=${REVERB[name]}` : null,
    `afade=t=out:st=${(total - fo).toFixed(3)}:d=${fo.toFixed(3)}:curve=qsin`, "alimiter=limit=0.89"].filter(Boolean).join(",");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", chain, "-t", total.toFixed(3), "-ar", "44100", "-b:a", "192k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg SFX " + name + ": " + r.stderr);
}
if (want("sfx")) {
  mkdirSync("assets/sfx/raw", { recursive: true });
  for (const x of SFX) {
    const raw = `assets/sfx/raw/${x.name}.mp3`, file = `assets/sfx/${x.name}.mp3`;
    if (!existsSync(raw) || FORCE) {
      process.stdout.write(`SFX ${x.name} (${x.duration} dtk) ... `);
      const r = api("POST", `/v1/sound-generation?output_format=${EL.outputFormat}`, { text: x.prompt, duration_seconds: x.duration, prompt_influence: 0.5 });
      if (r.netFail || r.status !== 200) {
        const why = r.netFail ? r.err : `HTTP ${r.status}: ${detail(r)}`;
        console.log("GAGAL -> tetap placeholder sintetis (" + why + ")");
        audio.sources.sfx[x.name] = "placeholder"; notes.push(`SFX ${x.name}: ${why}`); continue;
      }
      writeFileSync(raw, r.buf); console.log("ok");
    }
    processSfx(x.name, raw, file);
    data.sfx.files[x.name] = { file: `${x.name}.mp3`, ...analyze(file) };
    audio.sources.sfx[x.name] = "elevenlabs";
    console.log(`SFX ${x.name}: olah (fade in + reverb/ekor) -> ${data.sfx.files[x.name].dur} dtk, puncak ${data.sfx.files[x.name].peak} dtk`);
  }
}

// ---------- 3. MUSIK: SATU bed kontinu assets/music/bgm.mp3 ----------
// Urutan: (a) Music API satu track sepanjang video; (b) bila paket tidak mendukung -> beberapa stem dari endpoint Sound Effects
// (instrumental ambient, tiap stem <= 30 dtk) digabung dengan acrossfade >= 3 dtk (mis. 4 dtk), lalu dipotong tepat sepanjang video.
const M = EL.music;
if (want("music")) {
  mkdirSync("assets/music/stems", { recursive: true });
  const total = data.timing.total, outFile = `assets/music/${M.name}.mp3`;
  const sc = Object.fromEntries(data.timing.scenes.map((x) => [x.id, x]));
  const need = Math.ceil(total + 1);
  const already = existsSync(outFile) && audio.sources.music[M.name] && audio.sources.music[M.name] !== "placeholder" && ffprobeDur(outFile) >= total - 0.5;
  if (already && !FORCE) console.log(`Musik ${M.name}: sudah ada (${audio.musicDur?.[M.name] ?? "?"} dtk); lewati (--force untuk ulang)`);
  else {
    process.stdout.write(`Musik: Music API satu track ${need} dtk ... `);
    const SKIP_MUSIC_API = args.includes("--no-music-api");   // hemat kredit: langsung pakai stem yang sudah ada
    const r = SKIP_MUSIC_API ? { status: 0, buf: Buffer.from("dilewati (--no-music-api)") } : api("POST", `/v1/music?output_format=${EL.outputFormat}`, { prompt: M.prompts.calm, music_length_ms: need * 1000, force_instrumental: true, model_id: "music_v1" });
    if (r.status === 200) {
      writeFileSync(outFile, r.buf); audio.sources.music[M.name] = "elevenlabs-music"; console.log("ok");
    } else {
      console.log(`tidak tersedia (HTTP ${r.status}: ${detail(r)})`);
      notes.push(`Music API tidak tersedia di paket (HTTP ${r.status}): ${detail(r)}. Bed dibuat dari stem Sound Effects API + acrossfade.`);
      const XF = M.crossfade, SEG = M.stemSeconds, step = SEG - XF;
      const n = Math.ceil((need - XF) / step);
      // peran tiap stem menurut posisi pada timeline
      const roleAt = (t, i) => {
        if (i === 0) return "open";
        if (t >= sc.s8.start) return "resolve";
        if (t >= sc.s7.start) return "heroic";
        if (t >= sc.s5.end - 12) return "build";
        return "calm";
      };
      const stems = [], used = new Set();
      const poolFor = (role) => readdirSync("assets/music/stems").filter((x) => x.endsWith(`-${role}.mp3`)).sort();
      for (let i = 0; i < n; i++) {
        const tc = i * step + SEG / 2, role = i === n - 1 && tc >= sc.s7.start ? "resolve" : roleAt(tc, i);
        // pakai ulang stem yang sudah ada untuk peran ini (hemat kredit); buat baru hanya bila belum ada satu pun
        const pool = poolFor(role), free = pool.find((x) => !used.has(x));
        let f;
        if (!FORCE && free) f = `assets/music/stems/${free}`;
        else if (!FORCE && pool.length) f = `assets/music/stems/${pool[i % pool.length]}`;
        else {
          f = `assets/music/stems/stem${String(i + 1).padStart(2, "0")}-${role}.mp3`;
          process.stdout.write(`  stem ${i + 1}/${n} (${role}, ${SEG} dtk) ... `);
          let rr = api("POST", `/v1/sound-generation?output_format=${EL.outputFormat}`, { text: M.prompts[role], duration_seconds: SEG, prompt_influence: 0.6 });
          if (rr.status === 422) { rr = api("POST", `/v1/sound-generation?output_format=${EL.outputFormat}`, { text: M.prompts[role], duration_seconds: 22, prompt_influence: 0.6 }); }
          if (rr.status !== 200) { console.log("GAGAL"); notes.push(`Stem ${role} gagal (HTTP ${rr.status}): ${detail(rr)}`); stems.length = 0; stems.push("FAIL"); break; }
          writeFileSync(f, rr.buf); console.log("ok");
        }
        used.add(f.split("/").pop()); stems.push(f);
      }
      if (stems[0] === "FAIL") {
        // (d) cadangan terakhir: pad sinematik sintetis FFmpeg (PLACEHOLDER)
        const T = total.toFixed(2);
        const sines = [[110, 0.16], [220, 0.12], [261.63, 0.10], [329.63, 0.10], [392, 0.06], [55, 0.20]];
        const ins = sines.flatMap(([f]) => ["-f", "lavfi", "-i", `sine=f=${f}:d=${T}`]);
        const mix = sines.map(([, v], i) => `[${i}:a]volume=${v}[s${i}]`).join(";") + ";" + sines.map((_, i) => `[s${i}]`).join("") + `amix=inputs=${sines.length}:normalize=0,tremolo=f=0.12:d=0.35,lowpass=f=1800,aecho=0.8:0.6:900|1700:0.35|0.25,highpass=f=40,loudnorm=I=-22:TP=-3[out]`;
        const pr = spawnSync("ffmpeg", ["-v", "error", "-y", ...ins, "-filter_complex", mix, "-map", "[out]", "-ar", "44100", "-b:a", "192k", outFile], { encoding: "utf8" });
        if (pr.status !== 0) die("Pad cadangan gagal:\n" + pr.stderr);
        audio.sources.music[M.name] = "placeholder-ffmpeg-pad";
        notes.push("Musik: semua sumber API gagal; memakai pad sintetis FFmpeg (PLACEHOLDER).");
        console.log(`  -> ${outFile}: pad sintetis FFmpeg (PLACEHOLDER)`);
      } else {
      // samakan level tiap stem, gabung dengan acrossfade, potong sepanjang video
      const inputs = stems.flatMap((f) => ["-i", f]);
      const norm = stems.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,loudnorm=I=-22:TP=-3:LRA=7[n${i}]`);
      let chain = "", last = "n0";
      for (let i = 1; i < stems.length; i++) { chain += `;[${last}][n${i}]acrossfade=d=${XF}:c1=qsin:c2=qsin[x${i}]`; last = `x${i}`; }
      const fc = norm.join(";") + chain + `;[${last}]atrim=0:${total.toFixed(3)},asetpts=N/SR/TB[out]`;
      const j = spawnSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", fc, "-map", "[out]", "-ar", "44100", "-b:a", "192k", outFile], { encoding: "utf8" });
      if (j.status !== 0) die("Penggabungan stem gagal:\n" + j.stderr);
      audio.sources.music[M.name] = "elevenlabs-sound-generation-stems";
      audio.musicStems = stems;
      console.log(`  -> ${outFile}: ${stems.length} stem digabung, acrossfade ${XF} dtk`);
      }
    }
    audio.musicDur = { ...(audio.musicDur || {}), [M.name]: +ffprobeDur(outFile).toFixed(2) };
  }
}
data.elevenlabs = saveEL();
audio.notes = notes;
writeFileSync("data.json", JSON.stringify(data, null, 2) + "\n");

// ---------- laporan pemakaian ----------
const after = api("GET", "/v1/user/subscription");
if (after.status === 200 && usageBefore) {
  const u = JSON.parse(after.buf.toString("utf8"));
  console.log(`\nPemakaian kredit run ini: ${u.character_count - usageBefore.character_count} (total ${u.character_count}/${u.character_limit}, sisa ${u.character_limit - u.character_count})`);
}
console.log(`Karakter VO: ${totalChars}. Selesai - jalankan: node build.mjs`);
if (notes.length) console.log("\nCatatan:\n - " + notes.join("\n - "));

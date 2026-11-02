// node build.mjs -> data.js dari data.json, sinkron host scene/VO/SFX/musik di index.html, ducking, deteksi logo, speaker-notes.md
// Urutan kerja: (1) node generate-audio.mjs  (2) node build.mjs  (3) npm run check  (4) render
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const d = JSON.parse(readFileSync("data.json", "utf8"));
d.meta.logoExists = existsSync(d.meta.logoFile);

const scenes = d.timing.scenes, total = d.timing.total;
const start = Object.fromEntries(scenes.map((s) => [s.id, s.start]));
d.audio.dur = Object.fromEntries(scenes.map((s) => [s.id, +(s.end - s.start).toFixed(2)])); // sumber kebenaran = timing
writeFileSync("data.js", "window.RAKERNAS_DATA = " + JSON.stringify(d, null, 2) + ";\n");

let html = readFileSync("index.html", "utf8");
const setAttrs = (id, s, dur) => {
  html = html.replace(new RegExp(`(<div id="${id}"[^>]*?)data-start="[^"]*" data-duration="[^"]*"`), `$1data-start="${s}" data-duration="${dur}"`);
};
// root + layer sepanjang video
html = html.replace(/(data-composition-id="main" data-start="0" )data-duration="[^"]*"/, `$1data-duration="${total}"`);
for (const id of ["bg", "rig", "particles", "flash"]) setAttrs(id, 0, total);
setAttrs("footnote", +(start.s3 + 0).toFixed(2), +(scenes[4].end - start.s3 - 0.4).toFixed(2));
for (const s of scenes) setAttrs(s.id, s.start, +(s.end - s.start).toFixed(2));

// ---- VO ----
for (const s of d.vo.slots) {
  html = html.replace(new RegExp(`(<audio id="vo-${s.scene}"[^>]*?)data-start="[^"]*" data-duration="[^"]*"`), `$1data-start="${s.start}" data-duration="${s.dur}"`);
}

// ---- SFX ----
// File hasil API (assets/sfx/NAMA.mp3, metadata di data.sfx.files[NAMA]) dipakai bila ada; selain itu placeholder sintetis (.wav) lewat sfx.fallback.
const sfxSrc = (name) => {
  const m = d.sfx.files[name];
  if (m && m.file && existsSync(`assets/sfx/${m.file}`)) return { src: `assets/sfx/${m.file}`, meta: m, api: true };
  const fb = d.sfx.fallback?.[name] || name;
  return { src: `assets/sfx/${fb}.wav`, meta: d.sfx.files[fb], api: false };
};
const resolveAt = (e) => {
  const rel = typeof e.t === "number" ? e.t : d.audio.cues[e.scene]?.[e.t];
  if (rel == null) throw new Error(`SFX ${e.f}: cue "${e.t}" tidak ada di scene ${e.scene}`);
  return start[e.scene] + rel + (e.off || 0);
};
const lanes = [];
const sfxUsed = {};
const sfxWin = [];
const sfxTags = d.sfx.events.map((e, i) => {
  const { src, meta, api } = sfxSrc(e.f);
  sfxUsed[e.f] = api ? "elevenlabs" : "placeholder";
  const at = resolveAt(e), dur = Math.min(e.dur ?? meta.dur, +(total - at).toFixed(3));
  const st = Math.max(0, +(at + 1 / 30 - meta.peak).toFixed(3));
  let ln = lanes.findIndex((end) => end <= st); if (ln < 0) { ln = lanes.length; lanes.push(0); } lanes[ln] = st + dur;
  sfxWin.push({ f: e.f, st, en: st + dur, vol: e.vol });
  return `      <audio id="sfx-${i + 1}" class="clip" src="${src}" data-start="${st}" data-duration="${+dur.toFixed(3)}" data-track-index="${8 + ln}" data-volume="${e.vol}"></audio>`;
}).join("\n");
html = html.replace(/(<!-- SFX:BEGIN[^\n]*\n)[\s\S]*?([ \t]*<!-- SFX:END -->)/, `$1${sfxTags}\n$2`);

// ---- ducking + 3 bed musik dengan crossfade 1 dtk ----
const { high, ramp } = d.vo.duck;
const low = d.vo.duck.db != null ? +(high * 10 ** (d.vo.duck.db / 20)).toFixed(4) : d.vo.duck.low;
const pts = [{ t: 0, v: high }];
for (const s of d.vo.slots) {
  if (s.duck === false) continue;
  pts.push({ t: +(s.start - ramp).toFixed(2), v: high }, { t: s.start, v: low });
  pts.push({ t: +(s.start + s.dur).toFixed(2), v: low }, { t: +(s.start + s.dur + ramp).toFixed(2), v: high });
}
const valueAt = (t) => { for (let i = 1; i < pts.length; i++) if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i]; return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t); } return pts[pts.length - 1].v; };
const beds = d.elevenlabs.music;
const placeholderDur = 112;
const bgmTags = beds.map((b, i) => {
  const first = scenes.find((s) => s.id === b.scenes[0]), last = scenes.find((s) => s.id === b.scenes[b.scenes.length - 1]);
  const st = +(first.start - (i > 0 ? 0.5 : 0)).toFixed(2);
  const en = +(i === beds.length - 1 ? total : last.end + 0.5).toFixed(2);
  const isApi = d.audio.sources?.music?.[b.name] === "elevenlabs" && existsSync(`assets/music/${b.name}.mp3`);
  const maxDur = isApi ? d.audio.musicDur?.[b.name] ?? 9999 : placeholderDur;
  const dur = +Math.min(en - st, maxDur).toFixed(2);
  const rel = pts.map((p) => ({ t: +(p.t - st).toFixed(2), v: p.v })).filter((p) => p.t > 0 && p.t < dur);
  const lane = [{ t: 0, v: +valueAt(st).toFixed(4) }, ...rel];
  const attr = JSON.stringify({ version: 1, lanes: [{ target: "volume", points: lane }] }).replace(/"/g, "&quot;");
  const src = isApi ? `assets/music/${b.name}.mp3` : "assets/music/bgm-placeholder.mp3";
  b._src = isApi ? "elevenlabs" : "placeholder";
  return `      <audio id="${b.name}" class="clip" src="${src}" data-start="${st}" data-duration="${dur}" data-track-index="${6 + (i % 2)}" data-volume="1" data-fade-in="${i > 0 ? 1 : 0}" data-fade-out="${i < beds.length - 1 ? 1 : 2}" data-automation="${attr}"></audio>`;
}).join("\n");
html = html.replace(/(<!-- BGM:BEGIN[^\n]*\n)[\s\S]*?([ \t]*<!-- BGM:END -->)/, `$1${bgmTags}\n$2`);
writeFileSync("index.html", html);
// scene 1: jendela tampil teks mengikuti durasi scene
{
  let s1 = readFileSync("compositions/s1.html", "utf8");
  const dur1 = +(scenes[0].end - scenes[0].start - 5.0).toFixed(2);
  s1 = s1.replace(/(id="s1-l" class="clip" )data-start="[^"]*" data-duration="[^"]*"/, `$1data-start="5" data-duration="${dur1}"`)
         .replace(/(id="s1-year" class="clip" )data-start="[^"]*" data-duration="[^"]*"/, `$1data-start="5" data-duration="${dur1}"`);
  writeFileSync("compositions/s1.html", s1);
}

// peringatan: SFX keras yang menumpuk VO
for (const w of sfxWin) for (const s of d.vo.slots) {
  if (w.st < s.start + s.dur && w.en > s.start && w.vol > 0.35) console.warn(`PERINGATAN: SFX ${w.f} (vol ${w.vol}) menumpuk VO scene ${s.scene}`);
}

// ---- speaker-notes.md ----
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const VISUAL = {
  s1: "Lighting panggung menyala dan konvergen; impact + judul '3 Key Initiatives' lalu tahun.",
  s2: "Tiga kartu prioritas muncul bergantian sesuai kata yang disebut.",
  s3: "Key Initiative 1: lima kartu KPI (Delinq 30+, 90+, WO In, WO Recovery, LOR) muncul saat namanya disebut; counter berjalan tepat saat 'menjadi', tag selisih menyusul.",
  s4: "Key Initiative 2: panel realisasi cost vs plan; bar dan counter turun ke angka akhir saat disebut.",
  s5: "Key Initiative 3: ring KPI manager naik ke angka akhir saat disebut; lalu panel insentif.",
  s6: "'Telah Kita Selesaikan' lalu kilatan dan 'Ready for New Challenges'.",
  s7: "Tiga kartu Key Initiatives 2027 muncul saat 'Pertama/Kedua/Ketiga'; ketiganya menyala bersama di akhir.",
  s8: "Logo dan tagline, fade out.",
};
const script = d.audio.script || {};
const slot = Object.fromEntries(d.vo.slots.map((s) => [`s${s.scene}`, s]));
const rows = scenes.map((s, i) => {
  const sl = slot[s.id];
  const txt = script[s.id] ? script[s.id].replace(/\|/g, "\\|") : "_(belum digenerate - jalankan `node generate-audio.mjs`)_";
  return `| ${i + 1} | ${mmss(s.start)} - ${mmss(s.end)} | ${(s.end - s.start).toFixed(1)} dtk | VO mulai ${mmss(sl.start)}, ${sl.dur.toFixed(1)} dtk | ${VISUAL[s.id]} | ${txt} |`;
});
const cueRows = scenes.map((s) => {
  const c = d.audio.cues[s.id] || {};
  const list = Object.entries(c).filter(([k]) => k !== "end").map(([k, v]) => `${k} ${mmss(s.start + v)}`).join(", ");
  return `- **Scene ${s.id.slice(1)}**: ${list || "-"}`;
});
const notes = `# Speaker Notes - Opening Rakernas

Digenerate otomatis oleh \`node build.mjs\` dari data.json (jangan edit tangan; ubah vo.txt / data.json lalu generate ulang).
Total ${mmss(total)} (${total} dtk). Audio VO: ${d.audio.generated ? `ElevenLabs, suara ${d.audio.voice?.name || d.elevenlabs.voiceName}, model ${d.elevenlabs.modelId}` : "BELUM digenerate (slot senyap)"}.

| # | Waktu | Durasi scene | Audio VO | Visual / aksi | Teks narasi yang dibacakan |
|---|-------|--------------|----------|---------------|----------------------------|
${rows.join("\n")}

## Titik sinkron (kapan indikator muncul, waktu video)
${cueRows.join("\n")}

Catatan: durasi scene = durasi VO + lead + jeda 1 dtk (minimal sesuai animasi). Angka di naskah diambil dari data.json dan dibaca dengan kata.
`;
writeFileSync("speaker-notes.md", notes);

const sfxApi = Object.entries(sfxUsed).filter(([, v]) => v === "elevenlabs").map(([k]) => k);
const sfxPh = Object.entries(sfxUsed).filter(([, v]) => v === "placeholder").map(([k]) => k);
console.log(`data.js ditulis; logo asli: ${d.meta.logoExists}; total ${total} dtk; ducking ${pts.length} titik (${d.vo.duck.db ?? "?"} dB -> ${low})`);
console.log(`VO: ${d.audio.generated ? "ElevenLabs" : "placeholder senyap"} | SFX API: ${sfxApi.join(", ") || "-"} | SFX placeholder: ${sfxPh.join(", ") || "-"} | Musik: ${beds.map((b) => `${b.name}=${b._src}`).join(", ")}`);

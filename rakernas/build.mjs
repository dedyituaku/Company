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
  html = html.replace(new RegExp(`(<(?:div|canvas) id="${id}"[^>]*?)data-start="[^"]*" data-duration="[^"]*"`), `$1data-start="${s}" data-duration="${dur}"`);
};
// root + layer sepanjang video
html = html.replace(/(data-composition-id="main" data-start="0" )data-duration="[^"]*"/, `$1data-duration="${total}"`);
for (const id of ["bg", "rig", "particles", "flash"]) setAttrs(id, 0, total);
setAttrs("footnote", +(start.s3 + 0).toFixed(2), +(scenes[4].end - start.s3 - 0.4).toFixed(2));
for (const s of scenes) setAttrs(s.id, s.start, +(s.end - s.start).toFixed(2));

// ---- envelope: ducking musik/SFX saat VO (kurva cosine halus, bukan on-off) ----
const DK = d.vo.duck, ATT = DK.attack ?? 0.2, REL = DK.release ?? 0.8;
const voWins = d.vo.slots.filter((s) => s.duck !== false).map((s) => ({ a: s.start, b: +(s.start + s.dur).toFixed(3) }));
const smooth = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
// gain 1 -> g selama VO: turun selesai tepat saat VO mulai (attack), naik kembali setelah VO selesai (release)
const duckGain = (t, g, att = ATT, rel = REL) => voWins.reduce((m, w) => Math.min(m, 1 - (1 - g) * smooth((t - (w.a - att)) / att) * (1 - smooth((t - w.b) / rel))), 1);
const duckBreaks = (att = ATT, rel = REL, step = 0.04) => voWins.flatMap((w) => {
  const o = []; for (let t = w.a - att; t <= w.a + 1e-9; t += step) o.push(t); for (let t = w.b; t <= w.b + rel + 1e-9; t += step * 2) o.push(t); return o;
});
const laneAttr = (points) => JSON.stringify({ version: 1, lanes: [{ target: "volume", points }] }).replace(/"/g, "&quot;");
const setTag = (id, attrs) => {
  html = html.replace(new RegExp(`<audio id="${id}"([^>]*)>`), (_, rest) => {
    for (const k of Object.keys(attrs)) rest = rest.replace(new RegExp(`\\s*${k}="[^"]*"`), "");
    return `<audio id="${id}"${rest}${Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join("")}>`;
  });
};

// ---- VO: sinkron start/durasi + fade in 150 ms / out 250 ms ----
for (const s of d.vo.slots) {
  setTag(`vo-${s.scene}`, { "data-start": s.start, "data-duration": s.dur, "data-volume": s.gain ?? 1, "data-fade-in": d.vo.fadeIn ?? 0.15, "data-fade-out": d.vo.fadeOut ?? 0.25 });
}

// ---- SFX ----
// File olahan (assets/sfx/NAMA.mp3; fade in + reverb/ekor) dipakai bila ada; selain itu placeholder sintetis (.wav) lewat sfx.fallback.
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
const sfxUnder = d.sfx.sfxUnderVo ?? 0.45;
let sfxDucked = 0;
const sfxTags = d.sfx.events.map((e, i) => {
  const { src, meta, api } = sfxSrc(e.f);
  sfxUsed[e.f] = api ? "elevenlabs" : "placeholder";
  const at = resolveAt(e), dur = +Math.min(e.dur ?? meta.dur, total - at).toFixed(3);
  const st = Math.max(0, +(at + 1 / 30 - meta.peak).toFixed(3));
  let ln = lanes.findIndex((end) => end <= st); if (ln < 0) { ln = lanes.length; lanes.push(0); } lanes[ln] = st + dur;
  const fi = 0.015, fo = +(api ? Math.min(1.5, dur * 0.5) : Math.min(0.12, dur * 0.3)).toFixed(3);
  // SFX yang menyentuh VO diturunkan (kurva halus) supaya tidak menutup narasi
  const overlap = voWins.some((w) => st < w.b + 0.5 && st + dur > w.a - 0.15);
  let vol = e.vol, auto = "";
  if (overlap) {
    const ts = new Set([0, dur]);
    for (let t = 0.1; t < dur; t += 0.1) ts.add(+t.toFixed(2));
    for (const t of duckBreaks(0.15, 0.5)) { const r = +(t - st).toFixed(2); if (r > 0 && r < dur) ts.add(r); }
    const pts = [...ts].sort((x, y) => x - y).map((t) => ({ t, v: +(e.vol * duckGain(st + t, sfxUnder, 0.15, 0.5)).toFixed(4) }));
    auto = ` data-automation="${laneAttr(pts)}"`; vol = 1; sfxDucked++;
  }
  return `      <audio id="sfx-${i + 1}" class="clip" src="${src}" data-start="${st}" data-duration="${dur}" data-track-index="${8 + ln}" data-volume="${vol}" data-fade-in="${fi}" data-fade-out="${fo}"${auto}></audio>`;
}).join("\n");
html = html.replace(/(<!-- SFX:BEGIN[^\n]*\n)[\s\S]*?([ \t]*<!-- SFX:END -->)/, `$1${sfxTags}\n$2`);

// ---- musik: SATU bed kontinu; intensitas naik-turun (kunci waktu relatif scene) x ducking VO ----
const MU = d.elevenlabs.music;
const kf = MU.intensity.map((k) => {
  const sc = scenes.find((x) => x.id === k.scene), dur = sc.end - sc.start;
  const rel = k.t === "sceneEnd" ? dur : typeof k.t === "number" ? k.t : d.audio.cues[k.scene]?.[k.t];
  if (rel == null) throw new Error(`musik: cue "${k.t}" tidak ada di ${k.scene}`);
  return { t: +(sc.start + rel + (k.off || 0)).toFixed(2), v: k.v };
}).sort((x, y) => x.t - y.t);
const inten = (t) => {
  if (t <= kf[0].t) return kf[0].v; if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].v;
  for (let i = 1; i < kf.length; i++) if (t <= kf[i].t) { const a = kf[i - 1], b = kf[i]; return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t); }
};
const lowGain = 10 ** ((DK.db ?? -9) / 20);
const musicIsApi = !!d.audio.sources?.music?.[MU.name] && !/placeholder/.test(d.audio.sources.music[MU.name]) && existsSync(`assets/music/${MU.name}.mp3`);
const musicDur = musicIsApi ? Math.min(total, d.audio.musicDur?.[MU.name] ?? total) : Math.min(total, 112);
const tset = new Set([0, +musicDur.toFixed(2)]);
for (let t = 1; t < musicDur; t += 1) tset.add(t);
kf.forEach((k) => { if (k.t >= 0 && k.t <= musicDur) tset.add(k.t); });
for (const t of duckBreaks()) if (t > 0 && t < musicDur) tset.add(+t.toFixed(2));
const mpts = [...tset].sort((x, y) => x - y).map((t) => ({ t: +t.toFixed(2), v: +(inten(t) * duckGain(t, lowGain)).toFixed(4) }));
const bgmTag = `      <audio id="bgm" class="clip" src="${musicIsApi ? `assets/music/${MU.name}.mp3` : "assets/music/bgm-placeholder.mp3"}" data-start="0" data-duration="${+musicDur.toFixed(2)}" data-track-index="6" data-volume="${MU.level}" data-fade-in="${MU.fadeIn}" data-fade-out="${MU.fadeOut}" data-automation="${laneAttr(mpts)}"></audio>`;
html = html.replace(/(<!-- BGM:BEGIN[^\n]*\n)[\s\S]*?([ \t]*<!-- BGM:END -->)/, `$1${bgmTag}\n$2`);
const low = +lowGain.toFixed(3), pts = mpts;
writeFileSync("index.html", html);
// scene 1: jendela tampil teks mengikuti durasi scene
{
  let s1 = readFileSync("compositions/s1.html", "utf8");
  const dur1 = +(scenes[0].end - scenes[0].start - 5.0).toFixed(2);
  s1 = s1.replace(/(id="s1-l" class="clip" )data-start="[^"]*" data-duration="[^"]*"/, `$1data-start="5" data-duration="${dur1}"`)
         .replace(/(id="s1-year" class="clip" )data-start="[^"]*" data-duration="[^"]*"/, `$1data-start="5" data-duration="${dur1}"`);
  writeFileSync("compositions/s1.html", s1);
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
console.log(`data.js ditulis; logo asli: ${d.meta.logoExists}; total ${total} dtk; ducking/intensitas musik ${pts.length} titik (${d.vo.duck.db ?? "?"} dB, attack ${ATT}s, release ${REL}s); ${sfxDucked} SFX diturunkan saat VO`);
console.log(`VO: ${d.audio.generated ? "ElevenLabs" : "placeholder senyap"} | SFX API: ${sfxApi.join(", ") || "-"} | SFX placeholder: ${sfxPh.join(", ") || "-"} | Musik: bgm=${musicIsApi ? d.audio.sources.music[MU.name] : "placeholder"}`);

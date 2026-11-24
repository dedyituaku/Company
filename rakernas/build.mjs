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
setAttrs("footnote", +start.s3.toFixed(2), +(scenes[3].end - start.s3 - 0.4).toFixed(2));
setAttrs("footnote2", +start.s5.toFixed(2), +(scenes[4].end - start.s5 - 0.4).toFixed(2));
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
  setTag(`vo-${s.scene}`, { "data-start": s.start, "data-duration": +(s.dur - 0.04).toFixed(3), "data-volume": s.gain ?? 1, "data-fade-in": d.vo.fadeIn ?? 0.15, "data-fade-out": d.vo.fadeOut ?? 0.25 });
}

// ---- musik + SFX: SATU bus yang sudah dimix (assets/mix/bus.mp3, dibuat node mix-bus.mjs) ----
const busOk = existsSync("assets/mix/bus.mp3");
if (!busOk) console.warn("PERINGATAN: assets/mix/bus.mp3 belum ada - jalankan: node mix-bus.mjs");
else if (d.audio.bus && Math.abs(d.audio.bus.duration - total) > 0.05) console.warn(`PERINGATAN: bus (${d.audio.bus.duration} dtk) tidak sama dengan total video (${total} dtk) - jalankan ulang: node mix-bus.mjs`);
html = html.replace(/(<!-- SFX:BEGIN[^\n]*\n)[\s\S]*?([ \t]*<!-- SFX:END -->)/, "$1$2");
html = html.replace(/(<!-- BGM:BEGIN[^\n]*\n)[\s\S]*?([ \t]*<!-- BGM:END -->)/, `$1      <audio id="bus" class="clip" src="assets/mix/bus.mp3" data-start="0" data-duration="${total}" data-track-index="6" data-volume="1"></audio>\n$2`);
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
  s3: "Key Initiative 1: lima kartu KPI (Delinq 90+, 30+, WO Recovery, WO In, LOR) muncul saat namanya disebut; counter berjalan saat angka disebut; chip: amber netral untuk Budget, hijau hanya untuk yang membaik. DATA AKTUAL.",
  s4: "Key Initiative 2: satu kartu besar Realisasi Cost vs Plan (angka, bar, garis Target), lalu chip COC YTD. DATA AKTUAL.",
  s5: "Key Initiative 3: satu kartu ring 62% (manager dengan KPI < 2,25 pada 2025 yang membaik); chip hijau satu-satunya. DATA AKTUAL.",
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
const f2 = (v, n) => (v === undefined ? "-" : v.toFixed(n).replace(".", ","));
const dd = (k) => { const e = d[k]; const n = Math.max(...[e.before, e.after].filter((x) => x !== undefined).map((x) => (String(x).split(".")[1] || "").length)); return n; };
const kpiRows = ["delq90", "delq30", "woRecovery", "woIn", "lor"].map((k) => { const e = d[k], n = dd(k); return `| ${e.label} | ${f2(e.before, n)} | ${f2(e.after, n)} | ${e.unit} | ${e.budget !== undefined ? f2(e.budget, 2) : "-"} | ${e.chip.mode === "budget" ? "Budget (amber netral)" : e.chip.mode === "vsBudget" ? (e.after < e.budget ? "Di bawah budget (hijau)" : "Di atas budget (merah)") : e.chip.mode === "pct" ? `+${f2(e.chip.value, 1)}% (hijau)` : `${f2(Math.abs(e.after - e.before), n)} pp (${(e.better === "down") === (e.after < e.before) ? "hijau" : "merah"})`} |`; });
kpiRows.push(`| ${d.costVsPlan.label} | - | ${f2(d.costVsPlan.after, 0)} | ${d.costVsPlan.unit} | target ${f2(d.costVsPlan.target, 0)} | bar di bawah garis target |`);
kpiRows.push(`| ${d.cocYtd.label} | ${f2(d.cocYtd.before, 2)} | ${f2(d.cocYtd.after, 2)} | ${d.cocYtd.unit} | - | ${(d.cocYtd.better === "down") === (d.cocYtd.after < d.cocYtd.before) ? "hijau (membaik)" : "merah"} |`);
const notes = `# Speaker Notes - Opening Rakernas

Digenerate otomatis oleh \`node build.mjs\` dari data.json (jangan edit tangan; ubah vo.txt / data.json lalu generate ulang).
Total ${mmss(total)} (${total} dtk). Audio VO: ${d.audio.generated ? `ElevenLabs, suara ${d.audio.voice?.name || d.elevenlabs.voiceName}, model ${d.elevenlabs.modelId}` : "BELUM digenerate (slot senyap)"}.

| # | Waktu | Durasi scene | Audio VO | Visual / aksi | Teks narasi yang dibacakan |
|---|-------|--------------|----------|---------------|----------------------------|
${rows.join("\n")}

## Titik sinkron (kapan indikator muncul, waktu video)
${cueRows.join("\n")}

## Data aktual scene 3-4 (sumber: ${d.meta.source.file}, sheet ${d.meta.source.sheet}, ${d.meta.source.baseline})
${d.meta.source.catatan}

| KPI | 2025 (Des) | 2026* (YTD ${d.meta.ytdMonth}) | Satuan | Budget/Target | Chip |
|-----|-----------|------------------|--------|---------------|------|
${kpiRows.join("\n")}

Footnote layar (scene 3-4): ${d.meta.footnote}
Footnote layar (scene 5): ${d.scene5.footnote.replace("{r}", d.scene5.recorded).replace("{m}", d.scene5.missing)}

## Scene 5 - catatan data (sumber: ${d.scene5.source})
Kohort: ${d.scene5.cohort} manager dengan rata-rata KPI < ${String(d.scene5.threshold).replace(".", ",")} pada Jan-Sep 2025; tercatat di 2026 = ${d.scene5.recorded}; membaik dan di atas ambang = ${d.scene5.improved}; belum membaik = ${d.scene5.notImproved}; tidak ada di data MAM 2026 = ${d.scene5.missing}. Share = ${d.scene5.improved}/${d.scene5.recorded} = ${String(d.scene5.share).replace(".", ",")}% (tampil ${Math.round(d.scene5.share)}%).
${d.scene5.notes.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Catatan: durasi scene = durasi VO + lead + jeda 1 dtk (minimal sesuai animasi). Angka di naskah diambil dari data.json dan dibaca dengan kata.
`;
writeFileSync("speaker-notes.md", notes);

console.log(`data.js ditulis; logo asli: ${d.meta.logoExists}; total ${total} dtk; bus musik+SFX: ${busOk ? `assets/mix/bus.mp3 (${d.audio.bus?.sfxKept ?? "?"} SFX, master ${d.audio.bus?.masterGainDb ?? "?"} dB)` : "BELUM ADA"}`);
console.log(`VO: ${d.audio.generated ? "ElevenLabs" : "placeholder senyap"} | Musik: ${d.audio.sources?.music?.[d.elevenlabs.music.name] ?? "?"} | SFX: ${Object.entries(d.audio.sources?.sfx || {}).filter(([, v]) => v === "elevenlabs").length} dari API`);

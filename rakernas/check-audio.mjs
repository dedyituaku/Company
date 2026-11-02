#!/usr/bin/env node
// node check-audio.mjs <file.mp4|mp3> [waveform.png]
// Pemeriksaan audio: puncak/clipping, klik/pop (lonjakan antar-sampel), keheningan tak wajar, dan gambar waveform.
import { spawnSync } from "node:child_process";
const [inp, png] = process.argv.slice(2);
if (!inp) { console.error("pemakaian: node check-audio.mjs file [waveform.png]"); process.exit(1); }
const SR = 48000;
const r = spawnSync("ffmpeg", ["-v", "error", "-i", inp, "-vn", "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
const b = r.stdout, n = b.length >> 1;
let peak = 0, clip = 0, prev = 0; const jumps = [];
const rms = new Float64Array(Math.ceil(n / (SR / 10)));
for (let i = 0; i < n; i++) {
  const v = b.readInt16LE(i * 2) / 32768, a = Math.abs(v);
  if (a > peak) peak = a; if (a >= 0.999) clip++;
  const dj = Math.abs(v - prev);
  if (dj > 0.30 && i > 0) jumps.push(i / SR);   // lonjakan >0,3 FS dalam 1 sampel = klik/pop
  prev = v; rms[Math.floor(i / (SR / 10))] += v * v;
}
const db = (x) => (20 * Math.log10(x || 1e-9)).toFixed(1);
const win = rms.map((x) => Math.sqrt(x / (SR / 10)));
// keheningan: >0,5 dtk berturut-turut di bawah -70 dBFS (di tengah video)
let sil = [], run = 0;
for (let i = 0; i < win.length; i++) { if (win[i] < 10 ** (-70 / 20)) run++; else { if (run >= 5) sil.push([(i - run) / 10, run / 10]); run = 0; } }
if (run >= 5) sil.push([(win.length - run) / 10, run / 10]);
// klik: kelompokkan lonjakan berdekatan
const groups = []; for (const t of jumps) { if (!groups.length || t - groups[groups.length - 1].t > 0.05) groups.push({ t, n: 1 }); else groups[groups.length - 1].n++; }
const dur = n / SR;
// lonjakan RMS mendadak (>9 dB dalam 0,1 dtk) = kemungkinan pop/sambungan kasar
const surges = []; for (let i = 3; i < win.length; i++) { const a = win[i - 1] + 1e-9, c = win[i]; if (a > 10 ** (-50 / 20) && 20 * Math.log10(c / a) > 9) surges.push(+(i / 10).toFixed(1)); }
console.log(`durasi ${dur.toFixed(2)} dtk | puncak ${db(peak)} dBFS | sampel clipping (>=0,999): ${clip}`);
console.log(`klik/pop (lonjakan >0,3 FS per sampel): ${groups.length}${groups.length ? " di " + groups.slice(0, 12).map((g) => g.t.toFixed(2) + "s").join(", ") : ""}`);
console.log(`keheningan >0,5 dtk (< -70 dBFS): ${sil.length ? sil.map(([t, d]) => `${t.toFixed(1)}s(+${d.toFixed(1)})`).join(", ") : "tidak ada"}`);
console.log(`lonjakan level mendadak (>9 dB / 0,1 dtk): ${surges.length ? surges.slice(0, 15).join(", ") + "s" : "tidak ada"}`);
const ebu = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", inp, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const sum = ebu.slice(ebu.lastIndexOf("Summary:"));
console.log(`loudness: ${/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]} LUFS | LRA ${/LRA:\s+([\d.]+) LU/.exec(sum)?.[1]} LU | true peak ${/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]} dBFS`);
if (png) { spawnSync("ffmpeg", ["-v", "error", "-y", "-i", inp, "-vn", "-filter_complex", "aformat=channel_layouts=mono,showwavespic=s=2400x420:colors=#6fa8ff", "-frames:v", "1", png]); console.log("waveform ->", png); }

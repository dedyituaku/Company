#!/usr/bin/env node
// node finalize-video.mjs <masuk.mp4> <keluar.mp4> [--height=720]
// Pasca-render: skala video (default 720p), normalisasi loudness ke -14 LUFS (EBU R128 dua-pass) + limiter lembut, tanpa clipping.
import { spawnSync } from "node:child_process";
const [inp, out, ...rest] = process.argv.slice(2);
if (!inp || !out) { console.error("pemakaian: node finalize-video.mjs masuk.mp4 keluar.mp4 [--height=720]"); process.exit(1); }
const h = +(rest.find((a) => a.startsWith("--height="))?.slice(9) || 720);
const TARGET = { I: -14, TP: -1.5, LRA: 11 };
const af = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
// pass 1: ukur
const p1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", inp, "-vn", "-af", `${af}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
const m = /\{[^{}]*"input_i"[^{}]*\}/s.exec(p1.stderr);
if (!m) { console.error("gagal mengukur loudness:\n" + p1.stderr.slice(-800)); process.exit(2); }
const s = JSON.parse(m[0]);
console.log(`terukur: ${s.input_i} LUFS, TP ${s.input_tp} dBTP, LRA ${s.input_lra}`);
// pass 2: terapkan (linear) + skala
const af2 = `${af}:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true:print_format=summary,alimiter=limit=0.84:attack=5:release=80:level=disabled`; // limiter lembut sebagai pengaman puncak (~ -1.5 dBFS)
const r = spawnSync("ffmpeg", ["-hide_banner", "-y", "-i", inp, "-vf", `scale=-2:${h}:flags=lanczos`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
  "-af", af2, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], { encoding: "utf8" });
if (r.status !== 0) { console.error(r.stderr.slice(-1500)); process.exit(3); }
const chk = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", out, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
const sum = chk.stderr.slice(chk.stderr.lastIndexOf("Summary:"));
console.log(`hasil -> ${out}\n` + (/I:\s+(-?[\d.]+) LUFS/.exec(sum) ? `  loudness akhir: ${/I:\s+(-?[\d.]+) LUFS/.exec(sum)[1]} LUFS, true peak ${/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1] ?? "?"} dBFS` : ""));

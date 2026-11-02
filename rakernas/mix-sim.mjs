#!/usr/bin/env node
// node mix-sim.mjs [--master=-14]
// Simulasi mix dari index.html (tanpa render): tiap <audio> didekode, dikali data-volume x fade x automation, lalu dijumlah.
// Mengukur per scene: musik saja, VO saja, SFX saja, dan mix penuh (ebur128 + volumedetect). Dipakai untuk memverifikasi level musik
// sebelum render 20 menit. Angka "final" = setelah gain master (loudnorm ke -14 LUFS).
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const SR = 48000;
const d = JSON.parse(readFileSync("data.json", "utf8"));
const html = readFileSync("index.html", "utf8");
const total = d.timing.total, N = Math.ceil(total * SR);
const MASTER = +(process.argv.find((a) => a.startsWith("--master="))?.slice(9) ?? -14);
const attr = (tag, k) => { const m = new RegExp(`${k}="([^"]*)"`).exec(tag); return m ? m[1].replace(/&quot;/g, '"') : null; };
const tags = [...html.matchAll(/<audio\b[^>]*>/g)].map((m) => m[0]);
const bus = { music: new Float32Array(N), vo: new Float32Array(N), sfx: new Float32Array(N) };
const lane = (pts, t) => { if (t <= pts[0].t) return pts[0].v; for (let i = 1; i < pts.length; i++) if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i]; return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t); } return pts[pts.length - 1].v; };
for (const tag of tags) {
  const id = attr(tag, "id"), src = attr(tag, "src"), st = +attr(tag, "data-start"), dur = +attr(tag, "data-duration");
  const vol = +(attr(tag, "data-volume") ?? 1), fi = +(attr(tag, "data-fade-in") ?? 0), fo = +(attr(tag, "data-fade-out") ?? 0);
  const au = attr(tag, "data-automation"); const pts = au ? JSON.parse(au).lanes[0].points : null;
  const bus_ = id.startsWith("vo-") ? "vo" : id.startsWith("sfx-") ? "sfx" : "music";
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", src, "-t", String(dur), "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const buf = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2), n = Math.min(buf.length, Math.floor(dur * SR));
  const o = Math.round(st * SR), out = bus[bus_];
  for (let i = 0; i < n && o + i < N; i++) {
    const t = i / SR; let g = vol;
    if (pts) g *= lane(pts, t);
    if (fi > 0 && t < fi) g *= t / fi; if (fo > 0 && dur - t < fo) g *= Math.max(0, (dur - t) / fo);
    out[o + i] += buf[i] * g;
  }
}
const measure = (arr, a, b) => {
  const seg = arr.subarray(Math.floor(a * SR), Math.min(N, Math.floor(b * SR)));
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "-", "-af", "pan=stereo|c0=c0|c1=c0,ebur128=peak=true,volumedetect", "-f", "null", "-"], { input: Buffer.from(seg.buffer, seg.byteOffset, seg.byteLength), encoding: "utf8", maxBuffer: 1 << 26 });
  const s = r.stderr; const sum = s.slice(s.lastIndexOf("Summary:"));
  const I = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(sum)?.[1], mean = /mean_volume:\s+(-?[\d.]+|-inf) dB/.exec(s)?.[1];
  return { I: I === "-inf" || I == null ? -99 : +I, mean: mean === "-inf" || mean == null ? -99 : +mean };
};
const mixAll = new Float32Array(N); for (let i = 0; i < N; i++) mixAll[i] = bus.music[i] + bus.vo[i] + bus.sfx[i];
const full = measure(mixAll, 0, total), masterGain = MASTER - full.I;
console.log(`Mix penuh (pra-master): ${full.I} LUFS -> gain master ${masterGain.toFixed(1)} dB (target ${MASTER} LUFS)`);
const rows = [];
for (const s of d.timing.scenes) {
  const m = measure(bus.music, s.start, s.end), v = measure(bus.vo, s.start, s.end), x = measure(bus.sfx, s.start, s.end), a = measure(mixAll, s.start, s.end);
  // musik saat VO (ducked) vs di sela narasi: ukur terpisah
  const vo = d.vo.slots.find((q) => `s${q.scene}` === s.id);
  const mv = vo ? measure(bus.music, vo.start + 0.3, vo.start + vo.dur - 0.3) : { I: -99, mean: -99 };
  const gaps = []; let a0 = s.start; if (vo) { gaps.push([s.start, vo.start - 0.3], [vo.start + vo.dur + 1.0, s.end]); }
  const gl = gaps.filter(([p, q]) => q - p > 0.8).map(([p, q]) => measure(bus.music, p, q).I);
  rows.push({ s: s.id, dur: (s.end - s.start).toFixed(1), musikMean: (m.mean + masterGain).toFixed(1), musikLUFS: (m.I + masterGain).toFixed(1), musikSaatVO: (mv.I + masterGain).toFixed(1), musikSelaNarasi: gl.length ? (Math.max(...gl) + masterGain).toFixed(1) : "-", voLUFS: (v.I + masterGain).toFixed(1), sfxMean: (x.mean + masterGain).toFixed(1), mixLUFS: (a.I + masterGain).toFixed(1), gagal: m.mean + masterGain < -45 ? "GAGAL" : "ok" });
}
console.log("Level setelah master (-14 LUFS). musik* = musik saja; mean dalam dB, LUFS short-window per scene.");
console.table(rows);

// Menyesuaikan satu trek musik ke timeline: memperpanjang klimaks dengan LOOP satu bagian di batas bar (kelipatan tempo),
// crossfade >= 3 dtk yang selaras fase. Tempo diperkirakan dari autokorelasi onset. Tidak mengubah tempo/kunci.
import { spawnSync } from "node:child_process";
const SR = 8000;
const decode = (f) => { const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 29 }); return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2); };
export const durOf = (f) => parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);

export function analyzeTrack(f, bpmHint = 95) {
  const x = decode(f), hop = SR / 100;   // 10 ms
  const env = []; for (let i = 0; i + hop <= x.length; i += hop) { let e = 0; for (let j = 0; j < hop; j++) e += x[i + j] ** 2; env.push(Math.sqrt(e / hop)); }
  // RMS per detik (dB) untuk mencari penurunan besar menjelang akhir
  const db = []; for (let s = 0; s + 100 <= env.length; s += 100) { let e = 0; for (let k = 0; k < 100; k++) e += env[s + k] ** 2; db.push(10 * Math.log10(e / 100 + 1e-12)); }
  // onset: selisih positif envelope (dihaluskan 3 frame), autokorelasi untuk periode beat
  const on = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v)));
  const lo = Math.round(60 / (bpmHint * 1.15) * 100), hi = Math.round(60 / (bpmHint * 0.87) * 100);
  let best = 0, bl = lo; const ac = {};
  for (let lag = lo; lag <= hi; lag++) { let c = 0; for (let i = 0; i + lag < on.length; i++) c += on[i] * on[i + lag]; ac[lag] = c; if (c > best) { best = c; bl = lag; } }
  // interpolasi parabola untuk presisi sub-frame
  const a = ac[bl - 1] ?? ac[bl], b = ac[bl], c = ac[bl + 1] ?? ac[bl], off = (a - c) / (2 * (a - 2 * b + c) || 1);
  const beat = (bl + (Number.isFinite(off) ? Math.max(-0.5, Math.min(0.5, off)) : 0)) / 100;
  return { dur: x.length / SR, db, beat, bpm: 60 / beat };
}

// dropTarget: detik pada timeline akhir tempat klimaks harus berakhir (mis. akhir scene 7 - 1). total: panjang minimal bed.
export function fitMusic({ src: src0, out, total, dropTarget, bpmHint = 95, xfade = 4, log = console.log }) {
  // potong hening digital di awal trek (Music API memberi ~0,6 dtk) supaya musik terdengar sejak detik 0
  let src = src0;
  const sd = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-t", "5", "-i", src0, "-af", "silencedetect=n=-55dB:d=0.05", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const m0 = /silence_start: 0[\s\S]*?silence_end: ([\d.]+)/.exec(sd);
  if (m0 && +m0[1] > 0.05 && +m0[1] < 3) {
    src = out.replace(/\.mp3$/, ".trim.mp3");
    spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(m0[1]), "-i", src0, "-ar", "44100", "-b:a", "192k", src]);
    log(`  hening awal ${(+m0[1]).toFixed(2)} dtk dipotong`);
  }
  const t = analyzeTrack(src, bpmHint);
  // penurunan besar terakhir: perubahan >= 10 dB antar detik pada 25% akhir trek
  let drop = null; for (let s = Math.floor(t.db.length * 0.75); s < t.db.length - 1; s++) if (t.db[s] - t.db[s + 1] >= 10) { drop = s + 1; break; }
  const bar = 4 * t.beat;
  log(`  trek ${t.dur.toFixed(1)} dtk, tempo ~${t.bpm.toFixed(1)} BPM (bar ${bar.toFixed(3)} dtk), penurunan klimaks ~${drop ?? "-"} dtk`);
  let L = 0;
  if (drop !== null && dropTarget > drop + bar) L = Math.round((dropTarget - drop) / bar) * bar;   // perpanjangan = kelipatan bar
  let cmd;
  if (L > 0) {
    const t1 = Math.max(drop - 10, drop - 8), start = t1 - L;     // loncat mundur L dtk (kelipatan bar) di dalam klimaks
    if (start < 5) throw new Error("bagian klimaks terlalu pendek untuk di-loop");
    const fc = `[0:a]atrim=0:${(t1 + xfade).toFixed(3)},asetpts=PTS-STARTPTS[a];[0:a]atrim=${start.toFixed(3)},asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=${xfade}:c1=qsin:c2=qsin[o]`;
    cmd = ["-filter_complex", fc, "-map", "[o]"];
    log(`  loop klimaks: +${L.toFixed(2)} dtk (${Math.round(L / bar)} bar): loncat ${t1.toFixed(2)} -> ${start.toFixed(2)} dtk, crossfade ${xfade} dtk`);
  } else cmd = ["-map", "0:a"];
  const need = total + 1;
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", src, ...cmd, "-t", String(Math.max(need, 1)), "-ar", "44100", "-b:a", "192k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("fitMusic gagal: " + r.stderr);
  const dur = durOf(out);
  if (dur < total) log(`  PERINGATAN: bed (${dur.toFixed(1)} dtk) lebih pendek dari video (${total} dtk)`);
  return { dur, loop: L, bpm: t.bpm, drop };
}

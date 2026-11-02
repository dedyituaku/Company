// node make-sfx.mjs  -> membuat SFX SINTETIS (PLACEHOLDER) ke assets/sfx/ dengan FFmpeg lavfi. Ganti dengan SFX berlisensi nanti.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
mkdirSync("assets/sfx", { recursive: true });
const SR = 44100;
const run = (out, src, af) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", src, "-af", af, "-ar", String(SR), "-ac", "1", "-c:a", "pcm_s16le", `assets/sfx/${out}.wav`]);
// bandpass yang bergerak: daftar perintah asendcmd dari fungsi frekuensi
const sweep = (dur, fn, steps = 36) => Array.from({ length: steps + 1 }, (_, i) => { const t = (dur * i) / steps; return `${t.toFixed(3)} bandpass@b frequency ${Math.round(fn(t / dur))}`; }).join(";");

// whoosh A: naik lalu turun (0.9 dtk), puncak ~0.45
run("whoosh-a", `anoisesrc=d=0.9:c=pink:r=${SR}:a=0.9`,
  `asendcmd=c='${sweep(0.9, (u) => 320 + 3000 * Math.pow(Math.sin(Math.PI * u), 1.4))}',bandpass@b=f=320:t=q:w=1.1,afade=t=in:d=0.4:curve=qsin,afade=t=out:st=0.45:d=0.45:curve=qsin,volume=2.2,alimiter=limit=0.85`);
// whoosh B: menurun (0.8 dtk), puncak ~0.35
run("whoosh-b", `anoisesrc=d=0.8:c=pink:r=${SR}:a=0.9`,
  `asendcmd=c='${sweep(0.8, (u) => 3400 * Math.pow(1 - u, 1.5) + 280)}',bandpass@b=f=3400:t=q:w=1.0,afade=t=in:d=0.3:curve=qsin,afade=t=out:st=0.35:d=0.45:curve=qsin,volume=2.2,alimiter=limit=0.85`);
// boom: sinus rendah turun + sedikit noise, decay (1.8 dtk), puncak ~0.01
run("boom", `aevalsrc='(sin(2*PI*(38*t+(52/6)*(1-exp(-6*t))))*exp(-2.1*t)*0.9 + (random(0)*2-1)*0.22*exp(-16*t)):d=1.8:s=${SR}'`,
  `lowpass=f=900,afade=t=in:d=0.004,alimiter=limit=0.85`);
// riser: noise + chirp naik (2.7 dtk), puncak di ujung (~2.65)
run("riser", `aevalsrc='(sin(2*PI*(180*t+(1500/(2*2.7))*t*t))*0.35 + (random(0)*2-1)*0.45)*pow(t/2.7,2):d=2.7:s=${SR}'`,
  `highpass=f=600,lowpass=f=7000,afade=t=out:st=2.6:d=0.1,volume=1.6,alimiter=limit=0.85`);
// tick-run: klik lembut berulang ~14 Hz (2.0 dtk) untuk counter
run("tick-run", `aevalsrc='(sin(2*PI*2100*mod(t,0.0714))*exp(-mod(t,0.0714)*170)*0.55 + (random(0)*2-1)*exp(-mod(t,0.0714)*420)*0.15)*(0.75+0.25*sin(2*PI*t/2)):d=2.0:s=${SR}'`,
  `highpass=f=500,afade=t=out:st=1.8:d=0.2,alimiter=limit=0.8`);
// chime: arpeggio lembut naik + gema (1.4 dtk), puncak ~0.05
const n = (f, t0, a) => `gte(t,${t0})*sin(2*PI*${f}*(t-${t0}))*exp(-3.2*(t-${t0}))*${a}`;
run("chime", `aevalsrc='${n(1318.5, 0, 0.5)}+${n(1760, 0.09, 0.42)}+${n(2093, 0.18, 0.34)}+${n(2637, 0.27, 0.2)}:d=1.4:s=${SR}'`,
  `aecho=0.8:0.55:70|140:0.35|0.2,afade=t=in:d=0.005,afade=t=out:st=1.1:d=0.3,alimiter=limit=0.8`);
// swell: pad lembut (4.5 dtk), puncak tengah (~2.2)
const v = (f) => `sin(2*PI*${f}*t+0.6*sin(2*PI*5*t)/${f}*40)`;
run("swell", `aevalsrc='(${v(220)}*0.3+${v(277.2)}*0.25+${v(329.6)}*0.25+${v(440)}*0.15)*pow(sin(PI*t/4.5),2):d=4.5:s=${SR}'`,
  `lowpass=f=1800,aecho=0.8:0.6:120:0.3,alimiter=limit=0.8`);
// normalisasi puncak ke -3 dBFS (tanpa clipping); level akhir diatur lewat data-volume di timeline
import { readdirSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
for (const f of readdirSync("assets/sfx").filter((x) => x.endsWith(".wav"))) {
  const p = `assets/sfx/${f}`;
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", p, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const peak = parseFloat(/max_volume: (-?[\d.]+) dB/.exec(r.stderr)[1]);
  const gain = -3 - peak;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", p, "-af", `volume=${gain.toFixed(2)}dB`, "-c:a", "pcm_s16le", p + ".tmp.wav"]);
  renameSync(p + ".tmp.wav", p);
  console.log(f, "peak", peak, "dB ->", "-3 dB");
}
console.log("SFX placeholder dibuat di assets/sfx/ (semua PLACEHOLDER sintetis)");

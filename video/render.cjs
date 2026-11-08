// Render deterministik: seek GSAP per frame -> screenshot -> ffmpeg (MP4 1080x1920 @30fps)
// Pakai:  node render.cjs [--cut] [--out out/video.mp4] [--workers 4] [--dur s1:5,s2:11,...] [--audio narasi.wav]
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const FPS = 30, W = 1080, H = 1920;
const cut = flag('cut');
const out = path.resolve(opt('out', cut ? 'out/video_65s.mp4' : 'out/video_80s.mp4'));
const workers = parseInt(opt('workers', '4'), 10);
const durQ = opt('dur', '');
const narration = opt('audio', ''); // opsional: rekaman narator (wav/mp3) -> dicampur di atas musik
const frames = opt('frames', process.env.FRAMES_DIR || path.join(__dirname, '.frames'));
const url = 'file://' + path.join(__dirname, 'index.html') + `?cut=${cut ? 1 : 0}` + (durQ ? `&dur=${durQ}` : '');

function writeWav(file, samples, sr) { // samples: Float32Array mono -> 16-bit stereo wav
  const n = samples.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, samples[i])) * 32767 | 0; buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
  fs.writeFileSync(file, buf);
}

// Audio sintetis: drone ambient rendah (menghilang di S9) + "tick" halus untuk hitungan S2
function synthAudio(meta, file) {
  const sr = 44100, N = Math.ceil((meta.duration + 0.5) * sr), s = new Float32Array(N);
  const voices = [[55, .5, 0.05], [82.41, .35, 0.07], [110, .3, 0.09], [130.81, .16, 0.06], [164.81, .08, 0.11]];
  const fs0 = meta.musicFadeStart, fadeLen = 3.5;
  for (let i = 0; i < N; i++) {
    const t = i / sr; let v = 0;
    for (const [f, a, lfo] of voices) v += a * Math.sin(2 * Math.PI * f * t) * (0.75 + 0.25 * Math.sin(2 * Math.PI * lfo * t + f));
    let g = Math.min(1, t / 2.5);                         // fade-in
    if (t > fs0) g *= Math.max(0, 1 - (t - fs0) / fadeLen); // menghilang di S9
    s[i] = v * 0.10 * g;                                  // volume rendah
  }
  for (const tt of meta.ticks) {
    const st = Math.floor(tt * sr), len = Math.floor(0.03 * sr);
    for (let k = 0; k < len && st + k < N; k++) s[st + k] += 0.22 * Math.sin(2 * Math.PI * 2200 * k / sr) * Math.exp(-k / (0.006 * sr));
  }
  writeWav(file, s, sr);
}

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const browser = await chromium.launch();
  const probe = await browser.newPage({ viewport: { width: W, height: H } });
  await probe.goto(url); await probe.waitForFunction('window.__ready === true'); await probe.evaluate('document.fonts.ready');
  const meta = await probe.evaluate('window.__meta');
  await probe.close();
  const total = Math.round(meta.duration * FPS);
  console.log(`duration ${meta.duration}s, ${total} frames, ${meta.ticks.length} ticks`);
  fs.writeFileSync(path.join(path.dirname(out), (cut ? 'timing_65s' : 'timing_80s') + '.json'), JSON.stringify(meta, null, 1));

  const per = Math.ceil(total / workers); let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(url); await page.waitForFunction('window.__ready === true'); await page.evaluate('document.fonts.ready');
    for (let f = w * per; f < Math.min(total, (w + 1) * per); f++) {
      await page.evaluate(t => window.seek(t), f / FPS);
      await page.screenshot({ path: path.join(frames, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
      if (++done % 200 === 0) console.log(`${done}/${total}`);
    }
    await page.close();
  }));
  await browser.close();

  const wav = path.join(frames, 'bed.wav'); synthAudio(meta, wav);
  const inputs = ['-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', wav];
  let mapA = ['-map', '0:v', '-map', '1:a'];
  // narasi: klip audio/sN.mp3 (hasil gen_tts.cjs) ditaruh di awal scene + lead; atau --audio file tunggal
  const clips = meta.scenes.filter(s => fs.existsSync(path.join(__dirname, 'audio', s.id + '.mp3')));
  if (clips.length) {
    clips.forEach(s => inputs.push('-i', path.join(__dirname, 'audio', s.id + '.mp3')));
    const ms = s => Math.round((s.start + s.lead) * 1000);
    const fl = clips.map((s, k) => `[${k + 2}:a]adelay=${ms(s)}|${ms(s)},volume=1.6[n${k}]`).join(';');
    mapA = ['-filter_complex', fl + ';' + clips.map((_, k) => `[n${k}]`).join('') + `amix=inputs=${clips.length}:normalize=0[nv];[1:a][nv]amix=inputs=2:normalize=0:duration=longest[a]`, '-map', '0:v', '-map', '[a]'];
  } else if (narration) { inputs.push('-i', path.resolve(narration)); mapA = ['-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0:duration=first[a]', '-map', '0:v', '-map', '[a]']; }
  const r = spawnSync('ffmpeg', ['-y', ...inputs, ...mapA, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-t', String(meta.duration), '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  console.log('OK ->', out);
})();

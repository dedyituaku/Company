# Video Opening Rakernas (HyperFrames)

1920x1080, 30 fps, 112 dtk, Bahasa Indonesia. Status: draft v6 (audio ElevenLabs) di preview/rakernas-draft-v6.mp4; durasi mengikuti VO (lihat data.json > timing).

## Ganti angka / teks
1. Edit `data.json` (semua angka, logo, tagline; `meta.showDummyMarkers=false` menghapus semua penanda DUMMY).
2. `node build.mjs` (membuat `data.js` + ducking musik).
3. `npx hyperframes check` -> `npx hyperframes preview` -> `npx hyperframes render -o rakernas.mp4`

## Penanda DUMMY
Badge "DATA DUMMY" di scene 3-5, kotak putus-putus "LOGO PLACEHOLDER" dan "[ISI TAGLINE RAKERNAS]" di scene 7.
Garis tren delinquency adalah ilustrasi yang diturunkan dari before/after, bukan data bulanan.

## Audio
- `assets/vo/sceneN.mp3` = slot VO (file senyap placeholder). Timpa dengan hasil ElevenLabs (nama sama); script di `vo.txt`.
- `assets/music/bgm-placeholder.mp3` = musik latar senyap placeholder; ducking otomatis dari `data.json > vo`.
- Durasi scene sekarang tetap sesuai brief. Setelah VO asli masuk, sesuaikan `data-start/data-duration` host di `index.html`, `data.json > timing/vo`, lalu `node build.mjs`.

## Logo asli
Taruh file di `assets/logo/bfi-logo.png` lalu `node build.mjs`; scene 8 otomatis memakainya dan kotak "LOGO PLACEHOLDER" hilang.

## v4 - lighting, KPI, SFX
- **Lighting panggung:** `lib/rig.js` (canvas 2D additive, 16 beam, deterministik). Cue konvergensi/impact = detik 5.0 (`CUE.impact`); versi redup dipakai di scene 6-8. Bila scene 1 di-retime, ubah `CUE` di file itu dan `data-start` teks di `compositions/s1.html`.
- **Logo:** `assets/logo/bfi-logo.png` dipasang di panel putih membulat (proporsi asli). Catatan: isi file sebenarnya berformat WebP (ekstensi .png); Chromium tetap membacanya.
- **SFX = PLACEHOLDER SINTETIS** (semua file di `assets/sfx/`, dibuat `node make-sfx.mjs` dengan FFmpeg lavfi): `whoosh-a/b`, `boom`, `riser`, `tick-run`, `chime`, `swell`. Ganti dengan SFX berlisensi (nama file sama) sebelum rilis. Penempatan di timeline ada di `data.json > sfx.events` (build.mjs menulis `<audio id="sfx-N">` ke index.html; puncak bunyi 1 frame setelah momen visual).

## v6 - audio otomatis ElevenLabs
Alur: `node generate-audio.mjs` -> `node build.mjs` -> `npm run check` -> render.
- **Key:** `rakernas/.env` berisi `ELEVENLABS_API_KEY=...` (contoh: `.env.example`; `.env` ada di `.gitignore`, jangan di-commit). Skrip juga membaca environment.
- **Naskah:** `vo.txt` adalah template. `{{delq30.after}}` -> angka dari data.json dibaca dengan kata ("tiga koma delapan"); `{{dir:key|turun|naik}}` memilih kata arah; `[[nama]]` = penanda sinkron (tidak diucapkan). Blok `[PRONUNCIATION]` mengatur fonetik (WO, LOR, KPI, NPL-WO). Lihat komentar di atas file.
- `node generate-audio.mjs --dry` menampilkan naskah hasil render + jumlah karakter tanpa memanggil API.
- **Voice:** `data.json > elevenlabs` (voiceId, voiceName, stability, speed, ...). Ganti `voiceId` lalu `node generate-audio.mjs --only=vo && node build.mjs`.
- **Sinkron:** ElevenLabs `with-timestamps` memberi waktu tiap kata; waktu penanda disimpan di `data.json > audio.cues` (detik di dalam scene) dan dipakai `compositions/sN.html` (kartu/counter/tag muncul tepat saat disebut). Durasi scene = max(min animasi, lead + VO + 1 dtk).
- **SFX/Musik:** `elevenlabs.sfx[]` -> `assets/sfx/NAMA.mp3`; `elevenlabs.music[]` -> `assets/music/NAMA.mp3` (butuh paket berbayar; bila gagal otomatis pakai placeholder). Ducking musik -10 dB (`vo.duck.db`), crossfade bed 1 dtk.
- **Draft 720p + loudness -14 LUFS:** `npx hyperframes render --quality draft -o /tmp/raw.mp4` lalu `node finalize-video.mjs /tmp/raw.mp4 preview/rakernas-draft-v6.mp4 --height=720`.
- `speaker-notes.md` dibuat ulang oleh `node build.mjs`.

# Video Opening Rakernas (HyperFrames)

1920x1080, 30 fps, 112 dtk, Bahasa Indonesia. Status: draft v3 (112 dtk) di preview/rakernas-draft-v3.mp4.

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

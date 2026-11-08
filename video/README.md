# Video 1080×1920 · 30 fps · "Kesempatan Hidup"

HTML/CSS/GSAP, dirender deterministik (seek per frame → screenshot → ffmpeg) ke MP4.

```bash
cd video
node render.cjs                 # out/video_80s.mp4  (10 scene)
node render.cjs --cut           # out/video_65s.mp4  (tanpa S4 & S7, ±67 dtk)
node preview.cjs /path/folder   # 1 PNG per scene untuk cek cepat
```

## Menyesuaikan dengan rekaman suara
Setelah narasi direkam, ukur durasi tiap scene lalu:

```bash
node render.cjs --dur s1:5,s2:11.5,s3:10,s4:8,s5:8,s6:9.5,s7:5,s8:8,s9:9,s10:7 --audio narasi.wav
```

`--audio` dicampur di atas musik drone sintetis. Subtitle dibagi proporsional per karakter di dalam
jendela narasi tiap scene (`NARR_WIN` di `index.html`); geser jendela itu bila perlu agar sinkron persis.

## Catatan
- Area aman: semua teks di antara y=220 dan y=1540 (subtitle berakhir di y=1540).
- S9 tanpa subtitle karena kalimatnya sudah jadi visual; ditahan hening ±1,5 dtk di akhir.
- Audio bawaan hanya musik drone + "tick" S2 (sintetis). Suara narator belum ada.
- Font: serif/sans sistem (Liberation). Ganti `--serif`/`--sans` di CSS jika font brand tersedia.
- Angka JKN di footnote S10 dan data kasus diambil apa adanya dari naskah; belum diverifikasi.

# Diagnosis audio v10, jendela 2:10-2:30 (130-150 dtk)

Dibuat dengan `node diagnose-audio.mjs 130 150` pada build v10 (sebelum perubahan v11).

## Temuan
- **2:19 (139 dtk) jatuh di scene 6** (131,7-145,0 dtk di v10): "2026 Telah Kita Selesaikan" lalu "READY FOR NEW CHALLENGES 2027".
- **Layer aktif di 2:19:** VO scene 6, bed musik, riser, hit besar (initiatives-2027-hit), fanfare brass; applause menyusul di 139,7 dtk.
  Jadi di sekitar 136-142 dtk ada **4 SFX bersamaan** (riser + hit + fanfare + applause) di atas VO dan bed.
- **Bed bukan satu trek:** gabungan 8 stem yang dibuat terpisah (tiap 26 dtk, crossfade 4 dtk). Di 130-134 dtk ada sambungan stem *calm* ke *build*;
  kunci bed berpindah dari **D mayor (130-135)** ke **E minor (135-145)** lalu **E mayor (145-150)**: kunci tidak tetap.
- **Hit besar** berkunci **C mayor** (r=0,62) sementara bed E minor; **fanfare** berkunci **E minor** (r=0,9), nada brass tajam yang bersaing dengan VO dan bed.
- **Asal:** semua layer SFX dan bed berasal dari **ElevenLabs Sound Effects API** (generatif), bukan sintesis FFmpeg (sawtooth). Fanfare terdengar sintetis karena memang audio generatif; tetap dihapus sesuai permintaan.
- Level (RMS di jendela, setelah gain): bed -26,8 dB; hit -38 dB; fanfare -36 dB; riser -40,5 dB; applause -45 dB; whoosh -38,5 dB. Selisih antar layer jauh di atas 3 dB, dan layer SFX saling menumpuk.

## Tabel mentah
```
Jendela 130-150 dtk (2:10-2:30); scene: s5 (112.27-131.72), s6 (131.72-145.03), s7 (145.03-190.91)
┌─────────┬──────────┬───────────────────────────────────────┬────────┬────────┬───────┬───────────┬────────┬────────────────────────────────┬─────────────────────────────────┐
│ (index) │ id       │ src                                   │ start  │ end    │ gain  │ rmsMentah │ rmsMix │ kunci                          │ asal                            │
├─────────┼──────────┼───────────────────────────────────────┼────────┼────────┼───────┼───────────┼────────┼────────────────────────────────┼─────────────────────────────────┤
│ 0       │ 'vo-5'   │ 'assets/vo/scene5.mp3'                │ 112.77 │ 131.28 │ 1     │ -118.8    │ -118.8 │ 'tak-tonal (A# minor, r=0.29)' │ 'ElevenLabs TTS'                │
│ 1       │ 'vo-6'   │ 'assets/vo/scene6.mp3'                │ 132.12 │ 144.59 │ 1.122 │ -26.6     │ -25.6  │ 'tak-tonal (A minor, r=0.25)'  │ 'ElevenLabs TTS'                │
│ 2       │ 'vo-7'   │ 'assets/vo/scene7.mp3'                │ 145.53 │ 190.47 │ 1.216 │ -25.4     │ -23.7  │ 'tak-tonal (E minor, r=0.45)'  │ 'ElevenLabs TTS'                │
│ 3       │ 'sfx-7'  │ 'assets/sfx/whoosh.mp3'               │ 131.49 │ 133.14 │ 0.108 │ -19.2     │ -38.5  │ 'tak-tonal (E mayor, r=0.38)'  │ 'ElevenLabs Sound Effects API'  │
│ 4       │ 'sfx-8'  │ 'assets/sfx/whoosh.mp3'               │ 144.8  │ 146.45 │ 0.108 │ -19.2     │ -38.5  │ 'tak-tonal (E mayor, r=0.38)'  │ 'ElevenLabs Sound Effects API'  │
│ 5       │ 'sfx-10' │ 'assets/sfx/riser.mp3'                │ 136.02 │ 139.05 │ 0.117 │ -21.9     │ -40.5  │ 'tak-tonal (G# minor, r=0.28)' │ 'ElevenLabs Sound Effects API'  │
│ 6       │ 'sfx-11' │ 'assets/sfx/initiatives-2027-hit.mp3' │ 137.4  │ 144.98 │ 0.135 │ -20.6     │ -38    │ 'C mayor (r=0.62)'             │ 'ElevenLabs Sound Effects API'  │
│ 7       │ 'sfx-27' │ 'assets/sfx/chime.mp3'                │ 128.75 │ 131.31 │ 0.063 │ -68.5     │ -92.5  │ 'G mayor (r=0.65)'             │ 'ElevenLabs Sound Effects API'  │
│ 8       │ 'sfx-42' │ 'assets/sfx/timpani-roll.mp3'         │ 125.83 │ 130.88 │ 0.09  │ -120      │ -140.9 │ 'tak-tonal (C mayor, r=0)'     │ 'ElevenLabs Sound Effects API'  │
│ 9       │ 'sfx-43' │ 'assets/sfx/fanfare.mp3'              │ 136.64 │ 142.34 │ 0.126 │ -18       │ -36    │ 'E minor (r=0.9)'              │ 'ElevenLabs Sound Effects API'  │
│ 10      │ 'sfx-44' │ 'assets/sfx/applause.mp3'             │ 139.67 │ 146.31 │ 0.063 │ -21.2     │ -45.2  │ 'tak-tonal (G# minor, r=0.43)' │ 'ElevenLabs Sound Effects API'  │
│ 11      │ 'bgm'    │ 'assets/music/bgm-main.mp3'           │ 0      │ 200.33 │ 0.387 │ -18.6     │ -26.8  │ 'E minor (r=0.62)'             │ 'bed musik (gabungan stem API)' │
└─────────┴──────────┴───────────────────────────────────────┴────────┴────────┴───────┴───────────┴────────┴────────────────────────────────┴─────────────────────────────────┘
Stem bed (acrossfade 4 dtk, tiap 26 dtk):
  stem 5: stem02-calm.mp3  104-134 dtk  (sambungan crossfade 104-108)
  stem 6: stem04-build.mp3  130-160 dtk  (sambungan crossfade 130-134)
  bed 130-135 dtk: kunci D mayor (r=0.7, kedua A mayor)
  bed 135-140 dtk: kunci E minor (r=0.63, kedua E mayor)
  bed 140-145 dtk: kunci E minor (r=0.62, kedua E mayor)
  bed 145-150 dtk: kunci E mayor (r=0.67, kedua E minor)
```

## Perbaikan v11
- fanfare dihapus dari timeline dan dari daftar SFX; hit besar hanya di 3 momen (konvergensi lampu S1, READY S6, pembuka S7)
- bed diganti satu track Music API (D minor, ~95 BPM, tanpa brass, tanpa key change), klimaks diperpanjang lewat loop di batas bar
- semua musik dan SFX melewati satu bus reverb hall, low-pass musik 9 kHz, dip -3 dB di 2-4 kHz saat VO, level layer disamakan, maks. 2 SFX serentak (`mix-bus.mjs`)

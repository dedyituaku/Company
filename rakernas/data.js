window.RAKERNAS_DATA = {
  "_catatan": "SUMBER TUNGGAL angka & teks yang bisa diganti. Setelah edit jalankan: node build.mjs (membuat data.js + ducking musik). Semua nilai di bawah ini DUMMY kecuali dinyatakan lain.",
  "meta": {
    "showDummyMarkers": true,
    "dummyBadgeText": "DATA DUMMY",
    "logoText": "BFI",
    "logoNote": "LOGO PLACEHOLDER",
    "tagline": "[ISI TAGLINE RAKERNAS]",
    "taglineIsDummy": true
  },
  "delq30": {
    "before": 4.5,
    "after": 3.8,
    "unit": "%"
  },
  "woRecovery": {
    "before": 150,
    "after": 190,
    "unit": "Rp M"
  },
  "coc": {
    "before": 4.3,
    "after": 3.9,
    "unit": "%"
  },
  "costPerCollection": {
    "before": 100,
    "after": 85,
    "unit": "indeks"
  },
  "certifiedManager": {
    "before": 40,
    "after": 85,
    "unit": "%"
  },
  "incentiveGrowth": 18,
  "timing": {
    "_catatan": "Detik pada timeline utama. Ubah juga data-start/data-duration host di index.html jika durasi scene diubah (mis. setelah VO ElevenLabs masuk).",
    "scenes": [
      {
        "id": "s1",
        "start": 0,
        "end": 8
      },
      {
        "id": "s2",
        "start": 8,
        "end": 20
      },
      {
        "id": "s3",
        "start": 20,
        "end": 38
      },
      {
        "id": "s4",
        "start": 38,
        "end": 56
      },
      {
        "id": "s5",
        "start": 56,
        "end": 74
      },
      {
        "id": "s6",
        "start": 74,
        "end": 86
      },
      {
        "id": "s7",
        "start": 86,
        "end": 90
      }
    ],
    "flashAt": [
      8,
      20,
      38,
      56,
      74,
      86
    ]
  },
  "vo": {
    "_catatan": "Slot VO per scene. start = detik dari awal VIDEO. dur = estimasi durasi (DUMMY) sampai file ElevenLabs asli masuk; dipakai untuk ducking musik.",
    "slots": [
      {
        "scene": 1,
        "file": "assets/vo/scene1.mp3",
        "start": 1,
        "dur": 3
      },
      {
        "scene": 2,
        "file": "assets/vo/scene2.mp3",
        "start": 9,
        "dur": 5.5
      },
      {
        "scene": 3,
        "file": "assets/vo/scene3.mp3",
        "start": 21,
        "dur": 7
      },
      {
        "scene": 4,
        "file": "assets/vo/scene4.mp3",
        "start": 39,
        "dur": 7.5
      },
      {
        "scene": 5,
        "file": "assets/vo/scene5.mp3",
        "start": 57,
        "dur": 7.5
      },
      {
        "scene": 6,
        "file": "assets/vo/scene6.mp3",
        "start": 75,
        "dur": 4.5
      }
    ],
    "duck": {
      "high": 0.42,
      "low": 0.14,
      "ramp": 0.3
    }
  }
};

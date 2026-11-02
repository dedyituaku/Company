window.RAKERNAS_DATA = {
  "_catatan": "SUMBER TUNGGAL angka & teks yang bisa diganti. Setelah edit jalankan: node build.mjs (membuat data.js, sinkron slot audio, ducking musik, deteksi logo). Semua angka di bawah ini DUMMY. better = arah yang dianggap perbaikan (down/up).",
  "meta": {
    "showDummyMarkers": true,
    "dummyBadgeText": "DATA DUMMY",
    "yearBefore": "2025",
    "yearAfter": "2026*",
    "footnote": "*Projection EOY",
    "logoText": "BFI",
    "logoNote": "LOGO PLACEHOLDER",
    "logoFile": "assets/logo/bfi-logo.png",
    "tagline": "[ISI TAGLINE RAKERNAS]",
    "taglineIsDummy": true,
    "logoExists": true
  },
  "delq30": {
    "label": "Delinquency 30+",
    "before": 4.5,
    "after": 3.8,
    "unit": "%",
    "better": "down"
  },
  "delq90": {
    "label": "Delinquency 90+",
    "before": 1.6,
    "after": 1.3,
    "unit": "%",
    "better": "down"
  },
  "woIn": {
    "label": "WO In",
    "before": 80,
    "after": 65,
    "unit": "Rp M",
    "better": "down"
  },
  "woRecovery": {
    "label": "WO Recovery",
    "before": 150,
    "after": 190,
    "unit": "Rp M",
    "better": "up"
  },
  "lor": {
    "label": "LOR",
    "before": 13.7,
    "after": 8,
    "unit": "%",
    "better": "down"
  },
  "costVsPlan": {
    "label": "Realisasi Cost vs Plan",
    "before": 104,
    "after": 97,
    "unit": "%",
    "target": 100,
    "better": "down"
  },
  "incentiveGrowth": 18,
  "initiatives2027": [
    {
      "title": "Collection Effectiveness Transformation",
      "tagline": "Improve how we collect",
      "keywords": [
        "Scored Allocation",
        "Single-source Datamart & Customer 360",
        "Segment Turnaround",
        "Channel Mix Optimization"
      ]
    },
    {
      "title": "Recovery Resolution & Acceleration",
      "tagline": "Improve how we recover and resolve",
      "keywords": [
        "Debt Sale & Auction",
        "Segment-based NPL-WO Execution",
        "Legal Action as Resolution Lever",
        "Asset Selling Channels (HETO & IMS)"
      ]
    },
    {
      "title": "Collection Productivity & Capability Transformation",
      "tagline": "Improve who executes and how efficiently",
      "keywords": [
        "Productivity & Incentive Refinement",
        "Dynamic Capacity Management",
        "Capability Development",
        "New Product Readiness"
      ]
    }
  ],
  "timing": {
    "_catatan": "Detik pada timeline utama. Ubah juga data-start/data-duration host di index.html jika durasi scene diubah.",
    "total": 164.51,
    "scenes": [
      {
        "id": "s1",
        "start": 0,
        "end": 9.84
      },
      {
        "id": "s2",
        "start": 9.84,
        "end": 23.15
      },
      {
        "id": "s3",
        "start": 23.15,
        "end": 69.17
      },
      {
        "id": "s4",
        "start": 69.17,
        "end": 88.62
      },
      {
        "id": "s5",
        "start": 88.62,
        "end": 106.35
      },
      {
        "id": "s6",
        "start": 106.35,
        "end": 115.24
      },
      {
        "id": "s7",
        "start": 115.24,
        "end": 156.76
      },
      {
        "id": "s8",
        "start": 156.76,
        "end": 164.51
      }
    ],
    "flashAt": [
      9.84,
      23.15,
      69.17,
      88.62,
      106.35,
      115.24,
      156.76
    ]
  },
  "vo": {
    "_catatan": "Slot VO per scene diisi otomatis oleh generate-audio.mjs (start = awal scene + lead; dur = durasi file). duck: musik turun 'db' dB saat VO (ramp dtk). duck:false = tanpa ducking.",
    "slots": [
      {
        "scene": 1,
        "file": "assets/vo/scene1.mp3",
        "start": 5,
        "dur": 3.84
      },
      {
        "scene": 2,
        "file": "assets/vo/scene2.mp3",
        "start": 10.84,
        "dur": 11.311
      },
      {
        "scene": 3,
        "file": "assets/vo/scene3.mp3",
        "start": 24.15,
        "dur": 44.016
      },
      {
        "scene": 4,
        "file": "assets/vo/scene4.mp3",
        "start": 70.17,
        "dur": 17.45
      },
      {
        "scene": 5,
        "file": "assets/vo/scene5.mp3",
        "start": 89.62,
        "dur": 15.726
      },
      {
        "scene": 6,
        "file": "assets/vo/scene6.mp3",
        "start": 106.95,
        "dur": 7.288
      },
      {
        "scene": 7,
        "file": "assets/vo/scene7.mp3",
        "start": 116.24,
        "dur": 39.523
      },
      {
        "scene": 8,
        "file": "assets/vo/scene8.mp3",
        "start": 158.26,
        "dur": 5.251
      }
    ],
    "duck": {
      "high": 0.42,
      "db": -10,
      "ramp": 0.3
    }
  },
  "avgKpiManager": {
    "label": "Rata-rata KPI Manager",
    "before": 96,
    "after": 104,
    "unit": "%",
    "better": "up"
  },
  "sfx": {
    "_catatan": "SFX: file API ElevenLabs (assets/sfx/NAMA.mp3, dibuat generate-audio.mjs) bila ada; kalau tidak, build.mjs memakai placeholder sintetis lewat 'fallback'. Event: scene + t (nama cue di data.audio.cues atau detik di dalam scene) + off (offset detik); puncak bunyi jatuh 1 frame setelah momen visual. vol = data-volume (dijaga rendah agar tidak menutup VO).",
    "files": {
      "whoosh-a": {
        "dur": 0.9,
        "peak": 0.49
      },
      "whoosh-b": {
        "dur": 0.8,
        "peak": 0.39
      },
      "boom": {
        "dur": 1.8,
        "peak": 0.03
      },
      "riser": {
        "file": "riser.mp3",
        "dur": 3.03,
        "peak": 1.78
      },
      "tick-run": {
        "dur": 2,
        "peak": 0
      },
      "chime": {
        "file": "chime.mp3",
        "dur": 1.515,
        "peak": 0
      },
      "swell": {
        "dur": 4.62,
        "peak": 2.34
      },
      "opening-hit": {
        "file": "opening-hit.mp3",
        "dur": 6.034,
        "peak": 0.2
      },
      "initiatives-2027-hit": {
        "file": "initiatives-2027-hit.mp3",
        "dur": 5.042,
        "peak": 0.28
      },
      "whoosh": {
        "file": "whoosh.mp3",
        "dur": 1.228,
        "peak": 0.24
      },
      "logo-swell": {
        "file": "logo-swell.mp3",
        "dur": 5.042,
        "peak": 1.56
      }
    },
    "events": [
      {
        "f": "riser",
        "scene": "s1",
        "t": 5,
        "vol": 0.3,
        "note": "naik sebelum konvergensi lampu scene 1"
      },
      {
        "f": "opening-hit",
        "scene": "s1",
        "t": 5,
        "vol": 0.32,
        "note": "impact konvergensi + teks 3 Key Initiatives"
      },
      {
        "f": "whoosh",
        "scene": "s2",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh",
        "scene": "s3",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh",
        "scene": "s4",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh",
        "scene": "s5",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh",
        "scene": "s6",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh",
        "scene": "s7",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh",
        "scene": "s8",
        "t": 0,
        "vol": 0.28,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "riser",
        "scene": "s6",
        "t": "r",
        "vol": 0.24,
        "note": "naik menuju Ready for New Challenges"
      },
      {
        "f": "initiatives-2027-hit",
        "scene": "s6",
        "t": "r",
        "vol": 0.3,
        "note": "READY FOR NEW CHALLENGES 2027 muncul"
      },
      {
        "f": "tick-run",
        "scene": "s3",
        "t": "m1",
        "vol": 0.12,
        "note": "counter berjalan - s3 kartu 1",
        "dur": 1.5
      },
      {
        "f": "chime",
        "scene": "s3",
        "t": "m1",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s3 kartu 1",
        "off": 1.5
      },
      {
        "f": "tick-run",
        "scene": "s3",
        "t": "m2",
        "vol": 0.12,
        "note": "counter berjalan - s3 kartu 2",
        "dur": 1.5
      },
      {
        "f": "chime",
        "scene": "s3",
        "t": "m2",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s3 kartu 2",
        "off": 1.5
      },
      {
        "f": "tick-run",
        "scene": "s3",
        "t": "m3",
        "vol": 0.12,
        "note": "counter berjalan - s3 kartu 3",
        "dur": 1.5
      },
      {
        "f": "chime",
        "scene": "s3",
        "t": "m3",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s3 kartu 3",
        "off": 1.5
      },
      {
        "f": "tick-run",
        "scene": "s3",
        "t": "m4",
        "vol": 0.12,
        "note": "counter berjalan - s3 kartu 4",
        "dur": 1.5
      },
      {
        "f": "chime",
        "scene": "s3",
        "t": "m4",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s3 kartu 4",
        "off": 1.5
      },
      {
        "f": "tick-run",
        "scene": "s3",
        "t": "m5",
        "vol": 0.12,
        "note": "counter berjalan - s3 kartu 5",
        "dur": 1.5
      },
      {
        "f": "chime",
        "scene": "s3",
        "t": "m5",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s3 kartu 5",
        "off": 1.5
      },
      {
        "f": "tick-run",
        "scene": "s4",
        "t": "m",
        "vol": 0.12,
        "note": "counter berjalan - s4 rasio cost",
        "dur": 1.8
      },
      {
        "f": "chime",
        "scene": "s4",
        "t": "m",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s4",
        "off": 1.9
      },
      {
        "f": "tick-run",
        "scene": "s5",
        "t": "m",
        "vol": 0.12,
        "note": "counter berjalan - s5 ring KPI",
        "dur": 2
      },
      {
        "f": "chime",
        "scene": "s5",
        "t": "m",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s5 KPI",
        "off": 2.1
      },
      {
        "f": "tick-run",
        "scene": "s5",
        "t": "im",
        "vol": 0.12,
        "note": "counter berjalan - s5 insentif",
        "dur": 1.8
      },
      {
        "f": "chime",
        "scene": "s5",
        "t": "im",
        "vol": 0.2,
        "note": "nilai akhir tercapai - s5 insentif",
        "off": 1.4
      },
      {
        "f": "logo-swell",
        "scene": "s8",
        "t": 2.8,
        "vol": 0.26,
        "note": "logo muncul"
      },
      {
        "f": "chime",
        "scene": "s8",
        "t": 2.4,
        "vol": 0.2,
        "note": "tagline muncul"
      }
    ],
    "fallback": {
      "opening-hit": "boom",
      "initiatives-2027-hit": "boom",
      "whoosh": "whoosh-a",
      "riser": "riser",
      "chime": "chime",
      "logo-swell": "swell"
    }
  },
  "elevenlabs": {
    "voiceId": "onwK4e9ZLuTAKqWW03F9",
    "voiceName": "Daniel - Steady Broadcaster (pria, formal, ala penyiar)",
    "modelId": "eleven_multilingual_v2",
    "languageCode": "id",
    "stability": 0.5,
    "similarityBoost": 0.75,
    "style": 0,
    "speed": 1,
    "useSpeakerBoost": true,
    "outputFormat": "mp3_44100_128",
    "gapAfterVo": 1,
    "_catatan": "Konfigurasi generate-audio.mjs. Ganti voiceId/voiceName untuk mengganti suara narator (daftar: GET /v1/voices), lalu: node generate-audio.mjs --only=vo && node build.mjs. Pengaturan SFX/musik juga bisa diubah di sini (sfx[], music[]).",
    "sfx": [
      {
        "name": "opening-hit",
        "duration": 6,
        "prompt": "epic cinematic orchestral hit, deep sub boom, brass stab, cymbal swell, long reverb tail"
      },
      {
        "name": "initiatives-2027-hit",
        "duration": 5,
        "prompt": "heroic cinematic impact with rising shimmer"
      },
      {
        "name": "whoosh",
        "duration": 1.2,
        "prompt": "smooth cinematic whoosh transition, short airy sweep"
      },
      {
        "name": "riser",
        "duration": 3,
        "prompt": "cinematic tension riser building to a hit, rising synth and noise swell"
      },
      {
        "name": "chime",
        "duration": 1.5,
        "prompt": "soft bright positive success chime, single glassy bell with gentle shimmer"
      },
      {
        "name": "logo-swell",
        "duration": 5,
        "prompt": "uplifting cinematic logo reveal swell, warm rising pad with shimmer resolving gently"
      }
    ],
    "music": [
      {
        "name": "bgm-opening",
        "scenes": [
          "s1",
          "s2"
        ],
        "prompt": "instrumental cinematic epic build, no vocals, slow rising strings and low percussion, dark and powerful, gradual crescendo"
      },
      {
        "name": "bgm-achievement",
        "scenes": [
          "s3",
          "s4",
          "s5"
        ],
        "prompt": "instrumental corporate inspiring background music, 95 BPM, no vocals, soft pulsing synth and light piano, no dominant melody, leaves room for a voice-over, steady and optimistic"
      },
      {
        "name": "bgm-2027",
        "scenes": [
          "s6",
          "s7",
          "s8"
        ],
        "prompt": "instrumental heroic cinematic music, no vocals, triumphant brass and strings, builds steadily to a powerful climax, uplifting and ambitious"
      }
    ]
  },
  "audio": {
    "_catatan": "Diisi otomatis oleh generate-audio.mjs (generated=true). Nilai awal di bawah = timing brief lama agar proyek tetap bisa dirender sebelum audio dibuat. cues = detik DI DALAM scene tempat kata penanda [[...]] di vo.txt diucapkan; dipakai compositions/sN.html.",
    "generated": true,
    "lead": {
      "s1": 5,
      "s2": 1,
      "s3": 1,
      "s4": 1,
      "s5": 1,
      "s6": 0.6,
      "s7": 1,
      "s8": 1.5
    },
    "dur": {
      "s1": 9.84,
      "s2": 13.31,
      "s3": 46.02,
      "s4": 19.45,
      "s5": 17.73,
      "s6": 8.89,
      "s7": 41.52,
      "s8": 7.75
    },
    "cues": {
      "s1": {
        "y": 5,
        "k": 7.125,
        "end": 8.808
      },
      "s2": {
        "c1": 4.843,
        "c2": 7.281,
        "c3": 9.22,
        "end": 12.285
      },
      "s3": {
        "c1": 3.415,
        "m1": 7.803,
        "c2": 10.474,
        "m2": 15.918,
        "c3": 18.531,
        "m3": 22.072,
        "c4": 24.765,
        "m4": 29.096,
        "c5": 32.741,
        "m5": 36.735,
        "f": 38.72,
        "end": 44.978
      },
      "s4": {
        "p": 4.332,
        "m": 6.7,
        "end": 18.415
      },
      "s5": {
        "k": 4.471,
        "b": 7.177,
        "m": 9.046,
        "i": 11.762,
        "im": 13.875,
        "end": 16.697
      },
      "s6": {
        "y": 0.6,
        "r": 4.141,
        "end": 7.845
      },
      "s7": {
        "c1": 3.485,
        "c2": 15.78,
        "c3": 31.279,
        "end": 40.474
      },
      "s8": {
        "end": 6.701
      }
    },
    "script": {
      "s1": "dua ribu dua puluh enam. Tiga Key Initiatives.",
      "s2": "Di awal tahun, kita menetapkan tiga prioritas: meningkatkan efektivitas collection, mengoptimalkan cost, dan memperkuat kapabilitas manpower.",
      "s3": "Pertama, Collection Effectiveness. Delinquency tiga puluh plus turun dari empat koma lima persen menjadi tiga koma delapan persen. Delinquency sembilan puluh plus membaik dari satu koma enam persen menjadi satu koma tiga persen. WO In turun dari delapan puluh menjadi enam puluh lima miliar rupiah. WO Recovery naik dari seratus lima puluh menjadi seratus sembilan puluh miliar rupiah. Dan LOR membaik dari tiga belas koma tujuh persen menjadi delapan persen. Seluruh angka dua ribu dua puluh enam adalah proyeksi sampai akhir tahun.",
      "s4": "Kedua, Collection Cost Optimization. Realisasi cost terhadap plan berada di sembilan puluh tujuh persen, lebih baik dari seratus empat persen di tahun sebelumnya. Cost terealisasi sesuai plan, secara efektif dan efisien.",
      "s5": "Ketiga, Manpower Capability. Rata-rata KPI manager naik dari sembilan puluh enam persen menjadi seratus empat persen. Dan insentif manager meningkat delapan belas persen.",
      "s6": "dua ribu dua puluh enam telah kita selesaikan. Siap menghadapi tantangan dua ribu dua puluh tujuh.",
      "s7": "Tahun depan, tiga arah baru. Pertama, Collection Effectiveness Transformation: meningkatkan cara kita menagih, melalui scored allocation, datamart terpadu, segment turnaround, dan channel mix. Kedua, Recovery Resolution and Acceleration: mempercepat pemulihan dan penyelesaian, melalui debt sale, eksekusi NPL-WO, legal action, dan optimalisasi channel penjualan aset. Ketiga, Collection Productivity and Capability Transformation: memperkuat siapa yang mengeksekusi, dan seberapa efisien.",
      "s8": "Bersama, kita melangkah menuju dua ribu dua puluh tujuh."
    },
    "sources": {
      "sfx": {
        "opening-hit": "elevenlabs",
        "initiatives-2027-hit": "elevenlabs",
        "whoosh": "elevenlabs",
        "riser": "elevenlabs",
        "chime": "elevenlabs",
        "logo-swell": "elevenlabs"
      },
      "music": {
        "bgm-opening": "placeholder",
        "bgm-achievement": "placeholder",
        "bgm-2027": "placeholder"
      }
    },
    "voDur": {
      "s1": 3.84,
      "s2": 11.311,
      "s3": 44.016,
      "s4": 17.45,
      "s5": 15.726,
      "s6": 7.288,
      "s7": 39.523,
      "s8": 5.251
    },
    "chars": {
      "vo": 1791,
      "sfxSeconds": 21.7
    },
    "voice": {
      "id": "onwK4e9ZLuTAKqWW03F9",
      "name": "Daniel - Steady Broadcaster (pria, formal, ala penyiar)",
      "model": "eleven_multilingual_v2"
    },
    "notes": [
      "Musik bgm-opening: HTTP 402: Music API is not available for free users. Please upgrade to a paid plan to use the API.",
      "Musik bgm-achievement: HTTP 402: Music API is not available for free users. Please upgrade to a paid plan to use the API.",
      "Musik bgm-2027: HTTP 402: Music API is not available for free users. Please upgrade to a paid plan to use the API."
    ]
  }
};

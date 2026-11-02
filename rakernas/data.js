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
    "total": 112,
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
        "end": 40
      },
      {
        "id": "s4",
        "start": 40,
        "end": 58
      },
      {
        "id": "s5",
        "start": 58,
        "end": 76
      },
      {
        "id": "s6",
        "start": 76,
        "end": 86
      },
      {
        "id": "s7",
        "start": 86,
        "end": 106
      },
      {
        "id": "s8",
        "start": 106,
        "end": 112
      }
    ],
    "flashAt": [
      8,
      20,
      40,
      58,
      76,
      86,
      106
    ]
  },
  "vo": {
    "_catatan": "Slot VO per scene. start = detik dari awal VIDEO; dur = estimasi (DUMMY) sampai file ElevenLabs asli masuk. build.mjs menyinkronkan ini ke <audio> dan ducking. duck:false = tanpa ducking (slot cadangan).",
    "slots": [
      {
        "scene": 1,
        "file": "assets/vo/scene1.mp3",
        "start": 1,
        "dur": 3.2
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
        "dur": 9.5
      },
      {
        "scene": 4,
        "file": "assets/vo/scene4.mp3",
        "start": 41,
        "dur": 7
      },
      {
        "scene": 5,
        "file": "assets/vo/scene5.mp3",
        "start": 59,
        "dur": 6.8
      },
      {
        "scene": 6,
        "file": "assets/vo/scene6.mp3",
        "start": 77,
        "dur": 4.5
      },
      {
        "scene": 7,
        "file": "assets/vo/scene7.mp3",
        "start": 87,
        "dur": 15
      },
      {
        "scene": 8,
        "file": "assets/vo/scene8.mp3",
        "start": 107,
        "dur": 3,
        "duck": false
      }
    ],
    "duck": {
      "high": 0.42,
      "low": 0.14,
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
    "_catatan": "SFX SINTETIS = PLACEHOLDER (make-sfx.mjs). at = detik saat momen visual; build.mjs menaruh puncak bunyi 1 frame setelahnya. Waktu mengikuti animasi di compositions/*.html - ubah bila scene di-retime.",
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
        "dur": 2.7,
        "peak": 2.6
      },
      "tick-run": {
        "dur": 2,
        "peak": 0
      },
      "chime": {
        "dur": 1.54,
        "peak": 0.11
      },
      "swell": {
        "dur": 4.62,
        "peak": 2.34
      }
    },
    "events": [
      {
        "f": "riser",
        "at": 5,
        "vol": 0.32,
        "note": "naik sebelum konvergensi lampu scene 1"
      },
      {
        "f": "boom",
        "at": 5,
        "vol": 0.5,
        "note": "impact konvergensi + teks 3 Key Initiatives 2026"
      },
      {
        "f": "whoosh-a",
        "at": 8,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh-b",
        "at": 20,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh-a",
        "at": 40,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh-b",
        "at": 58,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh-a",
        "at": 76,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh-b",
        "at": 86,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "whoosh-a",
        "at": 106,
        "vol": 0.3,
        "note": "flash putih / transisi scene"
      },
      {
        "f": "riser",
        "at": 76,
        "vol": 0.28,
        "note": "naik sebelum scene 6"
      },
      {
        "f": "boom",
        "at": 80,
        "vol": 0.5,
        "note": "READY FOR NEW CHALLENGES 2027 muncul"
      },
      {
        "f": "tick-run",
        "at": 24.1,
        "dur": 1.5,
        "vol": 0.14,
        "note": "counter berjalan - s3 kartu 1"
      },
      {
        "f": "tick-run",
        "at": 25.2,
        "dur": 1.5,
        "vol": 0.14,
        "note": "counter berjalan - s3 kartu 2"
      },
      {
        "f": "tick-run",
        "at": 26.3,
        "dur": 1.5,
        "vol": 0.14,
        "note": "counter berjalan - s3 kartu 3"
      },
      {
        "f": "tick-run",
        "at": 27.5,
        "dur": 1.5,
        "vol": 0.14,
        "note": "counter berjalan - s3 kartu 4"
      },
      {
        "f": "tick-run",
        "at": 28.6,
        "dur": 1.5,
        "vol": 0.14,
        "note": "counter berjalan - s3 kartu 5"
      },
      {
        "f": "tick-run",
        "at": 46.4,
        "dur": 1.8,
        "vol": 0.14,
        "note": "counter berjalan - s4 rasio cost"
      },
      {
        "f": "tick-run",
        "at": 63.9,
        "dur": 2,
        "vol": 0.14,
        "note": "counter berjalan - s5 ring KPI"
      },
      {
        "f": "tick-run",
        "at": 69.2,
        "dur": 1.8,
        "vol": 0.14,
        "note": "counter berjalan - s5 insentif"
      },
      {
        "f": "chime",
        "at": 25.6,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s3 kartu 1"
      },
      {
        "f": "chime",
        "at": 26.7,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s3 kartu 2"
      },
      {
        "f": "chime",
        "at": 27.8,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s3 kartu 3"
      },
      {
        "f": "chime",
        "at": 29,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s3 kartu 4"
      },
      {
        "f": "chime",
        "at": 30.1,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s3 kartu 5"
      },
      {
        "f": "chime",
        "at": 48.2,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s4 rasio cost"
      },
      {
        "f": "chime",
        "at": 65.9,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s5 ring KPI"
      },
      {
        "f": "chime",
        "at": 71,
        "vol": 0.22,
        "note": "nilai akhir 2026* tercapai - s5 insentif"
      },
      {
        "f": "chime",
        "at": 107.3,
        "vol": 0.22,
        "note": "logo muncul"
      },
      {
        "f": "swell",
        "at": 108.8,
        "vol": 0.26,
        "note": "swell closing logo"
      }
    ]
  }
};

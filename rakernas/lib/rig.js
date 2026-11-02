// Rig lampu panggung (canvas 2D, additive). Semua gerak = fungsi murni dari waktu t (detik, timeline utama).
// Cue: IMPACT = detik beam konvergen + flash (teks "3 Key Initiatives 2026" muncul). Ubah jika scene 1 di-retime.
(function () {
  const W = 1920, H = 1080;
  const CUE = { igniteEnd: 2.4, widenEnd: 3.6, closeEnd: 4.6, convStart: 4.1, impact: 5.0, s1End: 8.0 };
  const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const lerp = (a, b, x) => a + (b - a) * x;
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rnd = mulberry32(7);

  // ---- 16 beam di 3 baris truss
  const rows = [{ y: 40, xs: [180, 444, 708, 972, 1236, 1500, 1740].slice(0, 6) }, { y: 112, xs: [300, 564, 828, 1092, 1356, 1620] }, { y: 184, xs: [560, 827, 1093, 1360] }];
  rows[0].xs = [170, 430, 690, 1230, 1490, 1750];
  const beams = [];
  rows.forEach((r, ri) => r.xs.forEach((x, i) => {
    const k = 0.25 + rnd() * 0.95, aimX = 960 - (x - 960) * k, aimY = 700 + rnd() * 120;
    beams.push({
      x, y: r.y, row: ri,
      fan: Math.atan2(aimX - x, aimY - r.y),
      conv: Math.atan2(960 - x, 540 - r.y),
      A: 0.14 + rnd() * 0.26, f: 0.07 + rnd() * 0.15, ph: rnd() * 6.283,
      ws: 0.8 + rnd() * 0.65, len: 1000 + rnd() * 300,
      gold: beams.length % 4 === 2, ice: beams.length % 3 === 0, idx: beams.length,
    });
  }));

  // ---- sprite beam (dibuat sekali, deterministik)
  const SW = 520, SL = 1250;
  function sprite(hw, blur, rgb, a0) {
    const c = document.createElement("canvas"); c.width = SW; c.height = SL + 60;
    const g = c.getContext("2d"); g.filter = "blur(" + blur + "px)";
    const gr = g.createLinearGradient(0, 0, 0, SL);
    gr.addColorStop(0, `rgba(${rgb},${a0})`); gr.addColorStop(0.1, `rgba(${rgb},${a0 * 0.62})`);
    gr.addColorStop(0.5, `rgba(${rgb},${a0 * 0.22})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(SW / 2 - 3, 0); g.lineTo(SW / 2 + 3, 0); g.lineTo(SW / 2 + hw, SL); g.lineTo(SW / 2 - hw, SL); g.closePath(); g.fill();
    return c;
  }
  const SP = {
    blue: [sprite(70, 9, "140,190,255", 0.95), sprite(170, 38, "47,128,237", 0.5)],
    ice: [sprite(60, 8, "215,235,255", 0.95), sprite(160, 36, "120,175,255", 0.45)],
    gold: [sprite(70, 9, "255,226,150", 0.95), sprite(170, 38, "212,165,55", 0.55)],
  };
  // pola piksel LED
  const pix = document.createElement("canvas"); pix.width = pix.height = 8;
  { const g = pix.getContext("2d"); g.fillStyle = "rgba(2,6,16,0.55)"; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8); }

  // ---- debu (seeded)
  const dust = []; for (let i = 0; i < 110; i++) dust.push({ x: rnd() * W, y: 60 + rnd() * 860, vx: (rnd() - 0.5) * 9, vy: -3 - rnd() * 6, r: 1.1 + rnd() * 1.9, ph: rnd() * 6.28 });

  // ---- envelope
  function G(t) { // intensitas global rig
    if (t < CUE.s1End - 0.1) return 1;
    if (t < 8.35) return 1 - sm(7.9, 8.35, t);
    if (t < 75.9) return 0;
    let g = 0.3 * sm(75.9, 76.4, t);
    if (t > 107) g = lerp(g, 0.42, sm(107, 110, t));
    if (t > 110.8) g *= 1 - 0.7 * sm(110.8, 112, t);
    return g;
  }
  function boost(t) { return t < CUE.impact ? 1 + 0.7 * sm(4.55, CUE.impact, t) : 1 + 0.7 * Math.exp(-(t - CUE.impact) / 0.45); }
  function spread(t) {
    if (t >= 8) return 1 + 0.3 * Math.sin(2 * Math.PI * t / 17);
    if (t < CUE.igniteEnd) return 1;
    if (t < CUE.widenEnd) return lerp(1, 1.75, sm(CUE.igniteEnd, CUE.widenEnd, t));
    return lerp(1.75, 0.4, sm(CUE.widenEnd, CUE.closeEnd, t));
  }
  function beamAngle(b, t) {
    const ampMod = t >= 8 ? 0.8 : t < CUE.igniteEnd ? 1 : t < CUE.closeEnd ? 0.55 : 0.07;
    const sweep = b.fan * spread(t) + b.A * ampMod * Math.sin(2 * Math.PI * b.f * t + b.ph);
    let c = t < 8 ? sm(CUE.convStart, CUE.impact, t) : 0.65 * sm(106, 109, t);
    return lerp(sweep, b.conv + 0.03 * Math.sin(t * 1.3 + b.ph), c);
  }
  function beamI(b, t) {
    if (t >= 8) return 0.8 + 0.2 * Math.sin(2 * Math.PI * (0.11 + b.f * 0.3) * t + b.ph);
    const on = sm(0.15 + b.idx * 0.1, 0.85 + b.idx * 0.1, t);
    return Math.max(b.idx === 0 ? 0.45 : 0, on) * (0.85 + 0.15 * Math.sin(2 * Math.PI * b.f * 3 * t + b.ph));
  }
  function goldMix(b, t) { if (!b.gold) return 0; return t < 8 ? sm(3.4, 5.0, t) : 0.45; }

  let cv, ctx;
  function render(t) {
    const g = G(t);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (g < 0.003) return;
    const bo = boost(t);
    // dasar gelap
    const bg = ctx.createRadialGradient(960, 420, 80, 960, 520, 1100);
    bg.addColorStop(0, "#10244a"); bg.addColorStop(0.55, "#0a1628"); bg.addColorStop(1, "#050c19");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // truss (siluet)
    ctx.strokeStyle = `rgba(70,105,170,${0.35 * g})`; ctx.fillStyle = "#04070f"; ctx.lineWidth = 1.5;
    [[40, 0, W], [112, 120, 1800], [184, 500, 1420]].forEach(([y, x0, x1]) => {
      ctx.fillRect(x0, y - 12, x1 - x0, 12); ctx.beginPath();
      for (let x = x0; x < x1; x += 34) { ctx.moveTo(x, y - 12); ctx.lineTo(x + 17, y); ctx.lineTo(x + 34, y - 12); }
      ctx.stroke(); ctx.strokeRect(x0, y - 12, x1 - x0, 12);
    });

    // haze volumetrik
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const cx = 960 + 760 * Math.sin(2 * Math.PI * t / (26 + i * 7) + i * 1.7), cy = 360 + 160 * Math.sin(2 * Math.PI * t / (19 + i * 5) + i), r = 620 + i * 90;
      const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      hg.addColorStop(0, `rgba(70,120,225,${0.085 * g * (0.7 + 0.3 * bo)})`); hg.addColorStop(1, "rgba(70,120,225,0)");
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    }

    // beam
    beams.forEach((b) => {
      const th = beamAngle(b, t), I = beamI(b, t) * g * bo, gm = goldMix(b, t);
      b._th = th; b._I = I;
      const kind = b.ice ? SP.ice : SP.blue;
      ctx.save(); ctx.translate(b.x, b.y + 8); ctx.rotate(-th); ctx.scale(b.ws * (1 + 0.25 * (bo - 1)), b.len / SL);
      [[0, 0.5], [1, 0.62]].forEach(([li, a]) => {
        if (gm < 1) { ctx.globalAlpha = Math.min(1, I * a * (1 - gm)); ctx.drawImage(kind[li], -SW / 2, 0); }
        if (gm > 0) { ctx.globalAlpha = Math.min(1, I * a * gm); ctx.drawImage(SP.gold[li], -SW / 2, 0); }
      });
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // titik sumber + bloom
    beams.forEach((b) => {
      const gm = goldMix(b, t), I = Math.min(1, b._I * 0.9), rr = 46 + 30 * (bo - 1);
      const sg = ctx.createRadialGradient(b.x, b.y + 12, 0, b.x, b.y + 12, rr);
      const col = gm > 0.5 ? "255,226,150" : "170,205,255";
      sg.addColorStop(0, `rgba(255,255,255,${I})`); sg.addColorStop(0.18, `rgba(${col},${0.7 * I})`); sg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = sg; ctx.fillRect(b.x - rr, b.y + 12 - rr, rr * 2, rr * 2);
    });

    // light pool di lantai
    beams.forEach((b) => {
      const hx = b.x + Math.tan(b._th) * (930 - b.y);
      if (hx < -200 || hx > W + 200) return;
      const gm = goldMix(b, t), col = gm > 0.5 ? "240,200,110" : "110,165,255", rx = 120 * b.ws;
      ctx.save(); ctx.translate(hx, 940); ctx.scale(1, 0.18);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      pg.addColorStop(0, `rgba(${col},${Math.min(0.6, b._I * 0.45)})`); pg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = pg; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
    });

    // LED panel kiri-kanan (pola radial biru)
    [[70, 520, 330, 360], [1520, 520, 330, 360]].forEach(([x, y, w, h], pi) => {
      const cx = x + w / 2, cy = y + h / 2, pb = g * (0.75 + 0.25 * (bo - 1));
      ctx.globalCompositeOperation = "lighter";
      const bl = ctx.createRadialGradient(cx, cy, 20, cx, cy, 330);
      bl.addColorStop(0, `rgba(47,128,237,${0.3 * pb})`); bl.addColorStop(1, "rgba(47,128,237,0)");
      ctx.fillStyle = bl; ctx.fillRect(cx - 330, cy - 330, 660, 660);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.75);
      pg.addColorStop(0, `rgba(120,185,255,${0.85 * pb})`); pg.addColorStop(0.45, `rgba(47,128,237,${0.6 * pb})`); pg.addColorStop(1, `rgba(10,40,110,${0.45 * pb})`);
      ctx.fillStyle = pg; ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 3;
      for (let r = 20; r < 300; r += 42) {
        const a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 0.45 * (pi ? -1 : 1) - r / 160)));
        ctx.strokeStyle = `rgba(200,225,255,${a * pb})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
      }
      ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) { const a0 = k / 14 * 6.283 + t * 0.12 * (pi ? -1 : 1); ctx.strokeStyle = `rgba(160,205,255,${0.2 * pb})`; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * 300, cy + Math.sin(a0) * 300); ctx.stroke(); }
      ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = ctx.createPattern(pix, "repeat"); ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = `rgba(110,160,235,${0.5 * g})`; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    });

    // lantai + siluet panggung
    ctx.globalCompositeOperation = "source-over";
    const fl = ctx.createLinearGradient(0, 872, 0, H);
    fl.addColorStop(0, "rgba(3,7,16,0.55)"); fl.addColorStop(1, "rgba(1,3,8,0.97)");
    ctx.fillStyle = fl; ctx.fillRect(0, 872, W, H - 872);
    ctx.fillStyle = `rgba(110,165,255,${0.28 * g})`; ctx.fillRect(0, 872, W, 2);
    ctx.fillStyle = "#03060d";
    // speaker stack kiri-kanan (tepi) + monitor lantai
    [[0, 760, 64, 130], [0, 640, 64, 120], [W - 64, 760, 64, 130], [W - 64, 640, 64, 120]].forEach(([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h); ctx.fillStyle = `rgba(100,150,230,${0.3 * g})`; ctx.fillRect(x, y, w, 2); ctx.fillStyle = "#03060d";
    });
    for (let i = 0; i < 7; i++) { const x = 360 + i * 190; ctx.beginPath(); ctx.moveTo(x, 880); ctx.lineTo(x + 70, 880); ctx.lineTo(x + 52, 858); ctx.lineTo(x + 18, 858); ctx.closePath(); ctx.fill(); }

    // debu terang saat melewati beam
    ctx.globalCompositeOperation = "lighter";
    dust.forEach((d) => {
      const x = ((d.x + d.vx * t) % W + W) % W, y = 60 + (((d.y - 60 + d.vy * t) % 860) + 860) % 860;
      let glow = 0;
      beams.forEach((b) => {
        const dx = x - b.x, dy = y - b.y - 8, dirx = Math.sin(b._th), diry = Math.cos(b._th), al = dx * dirx + dy * diry;
        if (al < 0 || al > b.len) return;
        const pp = Math.abs(dx * diry - dy * dirx), hw = 6 + 70 * b.ws * (al / SL) * 1.1;
        if (pp < hw) glow += (1 - pp / hw) * (1 - al / b.len) * Math.min(1.5, b._I / Math.max(g, 0.01)) * 0.9;
      });
      const tw = 0.7 + 0.3 * Math.sin(t * 1.7 + d.ph), a = (0.05 + Math.min(1, glow) * 0.85) * tw * Math.min(1, g * 1.4);
      ctx.fillStyle = `rgba(215,232,255,${a})`; ctx.beginPath(); ctx.arc(x, y, d.r * (1 + glow * 0.5), 0, 6.283); ctx.fill();
    });

    // flash hentakan saat impact
    if (t >= 4.85 && t < 7) {
      const fa = t < CUE.impact ? 0.26 * sm(4.85, CUE.impact, t) : 0.26 * Math.exp(-(t - CUE.impact) / 0.16);
      ctx.fillStyle = `rgba(205,228,255,${fa})`; ctx.fillRect(0, 0, W, H);
    }
    // vignette
    ctx.globalCompositeOperation = "source-over";
    const vg = ctx.createRadialGradient(960, 520, 420, 960, 540, 1180);
    vg.addColorStop(0, "rgba(2,5,12,0)"); vg.addColorStop(1, "rgba(2,5,12,0.82)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  window.RIG = {
    init(canvas) {
      cv = canvas; cv.width = W; cv.height = H; ctx = cv.getContext("2d");
      window.addEventListener("hf-seek", (e) => render(e.detail.time));
      render(0);
    },
    render,
  };
})();

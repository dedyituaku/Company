// Rig lampu panggung (canvas 2D, additive). Semua gerak = fungsi murni dari waktu t (detik, timeline utama).
// Cue: IMPACT = detik beam konvergen + flash (teks "3 Key Initiatives 2026" muncul). Ubah jika scene 1 di-retime.
(function () {
  const W = 1920, H = 1080;
  const CUE = { igniteEnd: 2.4, widenEnd: 3.6, closeEnd: 4.6, convStart: 4.1, impact: 5.0, s1End: 8.0 };
  // batas scene mengikuti durasi VO (data.json > timing); fallback ke brief awal
  const TM = (window.RAKERNAS_DATA && window.RAKERNAS_DATA.timing) || null;
  const S1E = TM ? TM.scenes[0].end : 8, LASTS = TM ? TM.scenes[TM.scenes.length - 1].start : 106, TOT = TM ? TM.total : 112;
  CUE.s1End = S1E;
  const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const lerp = (a, b, x) => a + (b - a) * x;
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rnd = mulberry32(7);

  // ---- 16 beam (sumber cahaya di atas frame)
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

  // ---- debu (seeded)
  const dust = []; for (let i = 0; i < 110; i++) dust.push({ x: rnd() * W, y: 60 + rnd() * 860, vx: (rnd() - 0.5) * 9, vy: -3 - rnd() * 6, r: 1.1 + rnd() * 1.9, ph: rnd() * 6.28 });

  // ---- envelope
  function G(t) { // intensitas global rig
    if (t < CUE.s1End - 0.1) return 1;
    if (t < S1E + 0.35) return 1 - sm(S1E - 0.1, S1E + 0.35, t);
    if (t < 75.9) return 0;
    let g = 0.3 * sm(75.9, 76.4, t);
    if (t > 107) g = lerp(g, 0.42, sm(107, 110, t));
    if (t > TOT - 1.2) g *= 1 - 0.7 * sm(TOT - 1.2, TOT, t);
    return g;
  }
  function boost(t) { return t < CUE.impact ? 1 + 0.7 * sm(4.55, CUE.impact, t) : 1 + 0.7 * Math.exp(-(t - CUE.impact) / 0.45); }
  function spread(t) {
    if (t >= S1E) return 1 + 0.3 * Math.sin(2 * Math.PI * t / 17);
    if (t < CUE.igniteEnd) return 1;
    if (t < CUE.widenEnd) return lerp(1, 1.75, sm(CUE.igniteEnd, CUE.widenEnd, t));
    return lerp(1.75, 0.4, sm(CUE.widenEnd, CUE.closeEnd, t));
  }
  function beamAngle(b, t) {
    const ampMod = t >= S1E ? 0.8 : t < CUE.igniteEnd ? 1 : t < CUE.closeEnd ? 0.55 : 0.07;
    const sweep = b.fan * spread(t) + b.A * ampMod * Math.sin(2 * Math.PI * b.f * t + b.ph);
    let c = t < S1E ? sm(CUE.convStart, CUE.impact, t) : 0.65 * sm(LASTS, LASTS + 3, t);
    return lerp(sweep, b.conv + 0.03 * Math.sin(t * 1.3 + b.ph), c);
  }
  function beamI(b, t) {
    if (t >= S1E) return 0.8 + 0.2 * Math.sin(2 * Math.PI * (0.11 + b.f * 0.3) * t + b.ph);
    const on = sm(0.15 + b.idx * 0.1, 0.85 + b.idx * 0.1, t);
    return Math.max(b.idx === 0 ? 0.45 : 0, on) * (0.85 + 0.15 * Math.sin(2 * Math.PI * b.f * 3 * t + b.ph));
  }
  function goldMix(b, t) { if (!b.gold) return 0; return t < S1E ? sm(3.4, 5.0, t) : 0.45; }

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

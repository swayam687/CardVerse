/* ============================================================
   fx/ParticleCanvas.js
   ============================================================ */
const FX = (() => {
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  let parts = [], raf = null, W = 0, H = 0;

  function resize() {
    W = cv.width = innerWidth * devicePixelRatio;
    H = cv.height = innerHeight * devicePixelRatio;
    cv.style.width = innerWidth + 'px';
    cv.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize); resize();

  function burst(x, y, color, count = 26, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.6 + Math.random() * 6.5) * power;
      parts.push({
        x: x * devicePixelRatio, y: y * devicePixelRatio,
        vx: Math.cos(a) * sp * devicePixelRatio * .55,
        vy: Math.sin(a) * sp * devicePixelRatio * .55 - 1.6 * devicePixelRatio,
        life: 1, decay: .012 + Math.random() * .018,
        size: (1.6 + Math.random() * 3.6) * devicePixelRatio,
        color, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += .16 * devicePixelRatio;
      p.vx *= .988; p.vy *= .988;
      p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12 * devicePixelRatio; ctx.shadowColor = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, W, H); }
  }

  function ring(x, y, color, count = 34) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const sp = 5.4;
      parts.push({
        x: x * devicePixelRatio, y: y * devicePixelRatio,
        vx: Math.cos(a) * sp * devicePixelRatio * .7,
        vy: Math.sin(a) * sp * devicePixelRatio * .7,
        life: 1, decay: .02, size: 3 * devicePixelRatio,
        color, rot: a, vr: .1
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return { burst, ring };
})();
/* Canvas confetti: tiny donuts, sprinkles, hearts and sparkles. */
import { reducedMotion } from './dom';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  s: number;
  c: string;
  k: number;
  life: number;
}

const COLORS = ['#f6a4c0', '#c9b8ff', '#8fd3c7', '#ffe08a', '#ff9ad5', '#ffffff', '#9fd8ea'];

export function confetti(canvas: HTMLCanvasElement, opts: { count?: number; duration?: number; from?: 'top' | 'center' } = {}) {
  if (reducedMotion()) return () => undefined;
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  resize();
  const W = () => canvas.width / dpr;
  const H = () => canvas.height / dpr;
  const bits: Bit[] = [];
  const add = (n: number) => {
    for (let i = 0; i < n; i++) {
      const center = opts.from === 'center';
      bits.push({
        x: center ? W() / 2 + (Math.random() - 0.5) * 60 : Math.random() * W(),
        y: center ? H() * 0.45 : -20 - Math.random() * H() * 0.4,
        vx: center ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 2,
        vy: center ? -Math.random() * 13 - 4 : Math.random() * 2 + 1,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        s: 6 + Math.random() * 8,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        k: Math.floor(Math.random() * 4),
        life: 1,
      });
    }
  };
  add(opts.count ?? 160);
  let raf = 0;
  const start = performance.now();
  const dur = opts.duration ?? 5000;
  const tick = (now: number) => {
    const t = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W(), H());
    for (const b of bits) {
      b.vy += 0.18;
      b.vx *= 0.99;
      b.vy *= 0.99;
      b.x += b.vx + Math.sin((now / 400) * (1 + b.k * 0.2) + b.s) * 0.6;
      b.y += b.vy;
      b.r += b.vr;
      if (t > dur - 800) b.life = Math.max(0, b.life - 0.02);
      ctx.save();
      ctx.globalAlpha = b.life;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      if (b.k === 0) {
        // tiny donut
        ctx.beginPath();
        ctx.arc(0, 0, b.s * 0.55, 0, Math.PI * 2);
        ctx.arc(0, 0, b.s * 0.22, 0, Math.PI * 2, true);
        ctx.fill();
      } else if (b.k === 1) {
        ctx.beginPath();
        ctx.roundRect(-b.s / 2, -b.s / 7, b.s, b.s / 3.5, b.s / 7);
        ctx.fill();
      } else if (b.k === 2) {
        const s = b.s * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.6, -s * 1.2, 0, -s * 0.4);
        ctx.bezierCurveTo(s * 0.6, -s * 1.2, s * 1.4, -s * 0.1, 0, s * 0.9);
        ctx.fill();
      } else {
        const s = b.s * 0.55;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = i % 2 ? s * 0.35 : s;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.fill();
      }
      ctx.restore();
    }
    if (t < dur) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, W(), H());
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, W(), H());
  };
}

/** A one-off burst over the whole page (used for wins). */
export function burst() {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'burst-canvas';
  c.setAttribute('aria-hidden', 'true');
  document.body.append(c);
  const top = document.getElementById('toasts');
  if (top?.matches?.(':popover-open')) top.append(c);
  confetti(c, { count: 120, duration: 3200, from: 'center' });
  setTimeout(() => c.remove(), 3400);
}

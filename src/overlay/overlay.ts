/* OBS Browser Source overlay (1920×1080, transparent).
 *  • Finale: celebrates for 14 s when the organizer writes a NEW finale token while the island is
 *    revealed. Never replays an old token on startup. Same contract as the original overlay.
 *    "Test the overlay" in the Organizer dashboard writes a test-… token that plays even while sealed.
 *  • ?test        → shows a test button and plays once (preview it in a normal browser)
 *  • ?duration=14 → length in seconds        • ?scale=1 → size of the title card
 *  • ?title=off   → the celebration (donuts, sprinkles, fireworks) without the big title card
 *  • ?mode=messages&every=12&pos=bl → rotates approved public love notes as a lower third
 *    (only after the reveal; RLS keeps everything else private). pos: bl, br, tl, tr. */
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/fredoka/wght.css';
import './overlay.css';
import { DEMO } from '../config';
import { api } from '../data/api';
import { SAMPLES } from '../data/samples';
import type { IslandEvent, Message } from '../data/types';
import { avatarSVG, donutSVG } from '../art/art';
import { esc } from '../ui/dom';

const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const DURATION = Math.min(60, Math.max(5, Number(params.get('duration')) || 14)) * 1000;
const SCALE = Math.min(2, Math.max(0.4, Number(params.get('scale')) || 1));
const MODE = params.get('mode') === 'messages' ? 'messages' : 'finale';
const EVERY = Math.min(120, Math.max(5, Number(params.get('every')) || 12)) * 1000;
const POS = ['bl', 'br', 'tl', 'tr'].includes(params.get('pos') ?? '') ? params.get('pos')! : 'bl';
const TITLE = !['off', 'no', 'none', 'hide', 'false', '0'].includes((params.get('title') ?? '').trim().toLowerCase());

document.documentElement.style.setProperty('--scale', String(SCALE));
const show = document.getElementById('show')!;
if (!TITLE) show.style.display = 'none'; // keep only the canvas: falling donuts, sprinkles, fireworks
document.getElementById('emblem')!.innerHTML = donutSVG({ frosting: 'strawberry', sprinkles: 'rainbow', face: true, seed: 'obs' });

/* ───────── polling (same contract as the original overlay) ───────── */

async function readEvent(): Promise<Partial<IslandEvent>> {
  if (DEMO) {
    // same default as the site's Preview Mode: the open "preview" edition
    try {
      return { id: 'preview', revealed: true, ...JSON.parse(localStorage.getItem('ddi-event') || '{}') };
    } catch {
      return { id: 'preview', revealed: true };
    }
  }
  const rows = await api<IslandEvent[]>('/rest/v1/island_event?singleton=eq.true&select=id,revealed,finale_token');
  return rows[0] ?? {};
}

let initial = true;
let last = '';
async function poll() {
  try {
    const e = await readEvent();
    const t = e.finale_token || '';
    // the real finale needs the surprise open; an organizer's "Test the overlay" (test-…) plays anytime
    if (!initial && t && t !== last && (e.revealed || t.startsWith('test-'))) celebrate();
    last = t;
    initial = false;
    if (TEST) status(`${DEMO ? 'Preview mode (this browser)' : 'Connected'} · ${e.revealed ? 'island open' : 'surprise sealed'}`);
  } catch (err) {
    console.warn('Overlay poll failed', err instanceof Error ? err.message : err);
    if (TEST) status('Could not reach the island. Check the Supabase settings.');
  }
}

function status(text: string) {
  const el = document.getElementById('test-status');
  if (el) el.textContent = text;
}

/* ───────── the celebration (canvas) ───────── */

const canvas = document.getElementById('fx') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
let W = 0;
let H = 0;
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

interface Donut {
  x: number;
  y: number;
  r: number;
  vy: number;
  rot: number;
  vr: number;
  sway: number;
  frost: string;
}
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  c: string;
  w: number;
  life: number;
  glow?: boolean;
}

const FROST = ['#f39db9', '#a7a0e5', '#87d5d0', '#fff0cb', '#d1b1e8', '#ffb38a', '#ff9ad5'];
const SPRINK = ['#fff6d1', '#8fd6e0', '#b9a3ee', '#ffffff', '#f2779a', '#ffd36e', '#9fe0b4'];
const FIRE = [
  ['#ff9ad5', '#ffd1ec', '#ffffff'],
  ['#9fe6ff', '#d6f6ff', '#ffffff'],
  ['#ffe08a', '#fff4c9', '#ffb3cc'],
  ['#c9b8ff', '#efe7ff', '#ff9ad5'],
];

let donuts: Donut[] = [];
let bits: Bit[] = [];
let raf = 0;
let start = 0;
let nextFirework = 0;

function drawDonut(d: Donut) {
  const r = d.r;
  g.save();
  g.translate(d.x, d.y);
  g.rotate(d.rot);
  g.shadowColor = 'rgba(80,40,80,.25)';
  g.shadowBlur = r * 0.4;
  g.shadowOffsetY = r * 0.15;
  g.fillStyle = '#e2ad72';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.arc(0, 0, r * 0.32, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.shadowColor = 'transparent';
  g.fillStyle = d.frost;
  g.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rr = r * (0.85 + Math.sin(i * 1.9) * 0.05);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.arc(0, 0, r * 0.38, 0, Math.PI * 2, true);
  g.fill('evenodd');
  for (let i = 0; i < 10; i++) {
    const a = i * 0.63;
    g.save();
    g.translate(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
    g.rotate(a * 2.3);
    g.fillStyle = SPRINK[i % SPRINK.length];
    g.beginPath();
    g.roundRect(-r * 0.13, -r * 0.04, r * 0.26, r * 0.08, r * 0.04);
    g.fill();
    g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.beginPath();
  g.ellipse(-r * 0.36, -r * 0.46, r * 0.24, r * 0.09, -0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function firework() {
  const x = W * (0.12 + Math.random() * 0.76);
  const y = H * (0.12 + Math.random() * 0.3);
  const colors = FIRE[Math.floor(Math.random() * FIRE.length)];
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (2 + Math.random() * 7) * (H / 1080);
    bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: 0, vr: 0, c: colors[i % colors.length], w: 3.2 * (H / 1080) + Math.random() * 2, life: 1.4 + Math.random() * 0.6, glow: true });
  }
}

function frame(now: number) {
  const t = now - start;
  const dt = 1 / 60;
  g.clearRect(0, 0, W, H);
  const ending = t > DURATION - 1400;
  // keep the sky full of donuts and sprinkles until the last moment
  if (!ending) {
    if (donuts.length < 30 && Math.random() < 0.5) {
      const r = (26 + Math.random() * 30) * (H / 1080) * 1.4;
      donuts.push({ x: Math.random() * W, y: -r * 2, r, vy: (2.2 + Math.random() * 2.4) * (H / 1080), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.04, sway: Math.random() * 10, frost: FROST[Math.floor(Math.random() * FROST.length)] });
    }
    for (let i = 0; i < 4; i++)
      bits.push({ x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 1.5, vy: (2 + Math.random() * 3) * (H / 1080), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: SPRINK[Math.floor(Math.random() * SPRINK.length)], w: (10 + Math.random() * 8) * (H / 1080), life: 99 });
    if (t > nextFirework) {
      firework();
      nextFirework = t + 500 + Math.random() * 900;
    }
  }
  for (const d of donuts) {
    d.y += d.vy;
    d.x += Math.sin(t / 700 + d.sway) * 0.6;
    d.rot += d.vr;
    drawDonut(d);
  }
  donuts = donuts.filter((d) => d.y < H + d.r * 2);
  for (const b of bits) {
    if (b.glow) {
      b.vx *= 0.97;
      b.vy = b.vy * 0.97 + 0.06;
      b.life -= dt;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.max(0, Math.min(1, b.life));
      g.fillStyle = b.c;
      g.beginPath();
      g.arc(b.x, b.y, b.w, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    } else {
      b.vy += 0.02;
      b.rot += b.vr;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      g.globalAlpha = 1;
      g.fillStyle = b.c;
      g.beginPath();
      g.roundRect(-b.w / 2, -b.w / 7, b.w, b.w / 3.5, b.w / 7);
      g.fill();
      g.restore();
    }
    b.x += b.vx;
    b.y += b.vy;
  }
  g.globalAlpha = 1;
  bits = bits.filter((b) => b.life > 0 && b.y < H + 30);
  if (t < DURATION || donuts.length || bits.length) raf = requestAnimationFrame(frame);
  else g.clearRect(0, 0, W, H);
}

function celebrate() {
  show.classList.remove('active');
  void show.offsetWidth;
  show.style.setProperty('--dur', `${DURATION}ms`);
  show.classList.add('active');
  cancelAnimationFrame(raf);
  donuts = [];
  bits = [];
  start = performance.now();
  nextFirework = 300;
  raf = requestAnimationFrame(frame);
  setTimeout(() => show.classList.remove('active'), DURATION);
}

/* ───────── optional: rotating love notes ───────── */

async function loadNotes(): Promise<Message[]> {
  const e = await readEvent();
  if (!e.revealed) return [];
  if (DEMO) {
    let rows: Message[] = [];
    try {
      rows = JSON.parse(localStorage.getItem('ddi-messages') || '[]');
    } catch {
      /* ignore */
    }
    const own = rows.filter((m) => m.event_id === e.id && m.status === 'approved' && m.visibility === 'public');
    return [...own, ...(e.id === 'preview' || !e.id ? SAMPLES : [])];
  }
  return api<Message[]>(
    '/rest/v1/island_messages?select=id,author,title,body,meta,category&status=eq.approved&visibility=eq.public&event_id=eq.' +
      encodeURIComponent(e.id ?? '') +
      '&order=created_at.desc&limit=200',
  );
}

async function runNotes() {
  const el = document.getElementById('notes')!;
  el.className = `notes-lt pos-${POS}`;
  let list: Message[] = [];
  let i = 0;
  const refresh = async () => {
    try {
      list = await loadNotes();
    } catch (err) {
      console.warn('Overlay notes failed', err);
    }
  };
  const next = () => {
    if (!list.length) {
      el.classList.remove('on');
      return;
    }
    const m = list[i++ % list.length];
    el.classList.remove('on');
    setTimeout(() => {
      const body = m.body.length > 230 ? m.body.slice(0, 227) + '…' : m.body;
      el.innerHTML = `<div class="lt-av">${avatarSVG(m.author || 'Anonymous Donut', m.meta?.frosting, m.meta?.sprinkles)}</div>
        <div class="lt-text"><b>${esc(m.title || 'A little note')}</b><p>${esc(body)}</p><small>— ${esc(m.author || 'Anonymous Donut')}${m.example ? ' · sample' : ''}</small></div>`;
      el.classList.add('on');
    }, 600);
  };
  await refresh();
  next();
  setInterval(next, EVERY);
  setInterval(refresh, 60_000);
}

/* ───────── start ───────── */

if (TEST) {
  document.getElementById('test-bar')!.hidden = false;
  document.getElementById('test-btn')!.onclick = celebrate;
  document.body.classList.add('test');
  if (MODE === 'finale') celebrate();
}
if (MODE === 'messages') void runNotes();
void poll();
setInterval(poll, 2000);


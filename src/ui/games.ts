/* Two tiny games: Sprinkle Hunt (memory match) and Donut Drop (60-second arcade dash). */
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { html, raw } from './dom';
import { dialogOpen, openDialog } from './dialog';
import { burst } from './confetti';
import { toast } from './toast';

/* ───────── Sprinkle Hunt ───────── */

const ICONS = ['🍩', '🐚', '🎮', '⭐', '💎', '🗝️', '🌴', '🌸'];

export function sprinkleHunt() {
  const deck = [...ICONS, ...ICONS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const best = progress.state.memoryBest;
  openDialog(
    'Sprinkle Hunt',
    html`<p class="dialog-lead">Flip two tiles at a time and find all eight matching island treasures. Fewer moves is better!</p>
      <div class="memory-stats"><span>Moves <b id="mem-moves">0</b></span><span>Pairs <b id="mem-pairs">0</b>/8</span><span>Best <b>${best ? `${best} moves` : '—'}</b></span></div>
      <div class="memory" id="memory">${deck.map(
        (icon, i) => html`<button type="button" class="mem" data-mem="${i}" aria-label="Hidden tile ${i + 1}"><span class="mem-in"><span class="mem-back" aria-hidden="true"></span><span class="mem-face">${icon}</span></span></button>`,
      )}</div>
      <p class="status center" id="mem-status" aria-live="polite">Find the pairs!</p>
      <div class="actions dialog-actions"><button type="button" class="btn light" data-exp="game">New round</button><button type="button" class="btn" data-close>Done</button></div>`,
    { variant: 'game', icon: '✦', key: 'game' },
  );
  let first: HTMLButtonElement | null = null;
  let lock = false;
  let moves = 0;
  let pairs = 0;
  const grid = document.getElementById('memory')!;
  grid.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mem');
    if (!b || lock || b.classList.contains('open') || b.classList.contains('matched')) return;
    const i = Number(b.dataset.mem);
    b.classList.add('open');
    b.setAttribute('aria-label', `Tile ${i + 1}: ${deck[i]}`);
    sound.flip();
    if (!first) {
      first = b;
      return;
    }
    moves++;
    document.getElementById('mem-moves')!.textContent = String(moves);
    const a = first;
    first = null;
    if (deck[Number(a.dataset.mem)] === deck[i]) {
      a.classList.add('matched');
      b.classList.add('matched');
      pairs++;
      sound.sprinkle(pairs);
      document.getElementById('mem-pairs')!.textContent = String(pairs);
      if (pairs === 8) {
        const improved = progress.score('memoryBest', moves, 'lower');
        document.getElementById('mem-status')!.textContent = `You found every pair in ${moves} moves! ${improved ? 'New best! ✨' : 'Sweet victory. ✨'}`;
        sound.success();
        burst();
        toast(`Sprinkle Hunt cleared in ${moves} moves`, { icon: '🧠' });
      }
    } else {
      lock = true;
      setTimeout(() => {
        a.classList.remove('open');
        b.classList.remove('open');
        a.setAttribute('aria-label', `Hidden tile ${Number(a.dataset.mem) + 1}`);
        b.setAttribute('aria-label', `Hidden tile ${i + 1}`);
        lock = false;
      }, 750);
    }
  };
}

/* ───────── Donut Drop ───────── */

const W = 420;
const H = 600;
const GROUND = H - 70;
type Kind = 'donut' | 'sprinkle' | 'gold' | 'burnt';
interface Item {
  kind: Kind;
  x: number;
  y: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  hue: string;
}
interface Gull {
  x: number;
  y: number;
  vx: number;
  t: number;
  hit: boolean;
}
interface Fx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
  text?: string;
}

const FROST = ['#f39db9', '#a7a0e5', '#87d5d0', '#fff0cb', '#d1b1e8', '#ffb38a'];

function drawDonut(g: CanvasRenderingContext2D, r: number, frost: string, burnt = false, gold = false) {
  g.fillStyle = burnt ? '#5a3a2e' : gold ? '#e9b44c' : '#e2ad72';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.arc(0, 0, r * 0.32, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.fillStyle = burnt ? '#3b241d' : gold ? '#ffd970' : frost;
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r * (0.86 + Math.sin(i * 1.7) * 0.05);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.arc(0, 0, r * 0.38, 0, Math.PI * 2, true);
  g.fill('evenodd');
  if (!burnt) {
    const sc = ['#fff6d1', '#8fd6e0', '#b9a3ee', '#ffffff', '#f2779a'];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8;
      const rr = r * 0.62;
      g.save();
      g.translate(Math.cos(a) * rr, Math.sin(a) * rr);
      g.rotate(a * 2);
      g.fillStyle = gold ? '#fff8dc' : sc[i % sc.length];
      g.fillRect(-r * 0.13, -r * 0.04, r * 0.26, r * 0.08);
      g.restore();
    }
  } else {
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.fillRect(-r * 0.5, -r * 0.1, r * 0.3, r * 0.06);
  }
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.45, r * 0.25, r * 0.1, -0.6, 0, Math.PI * 2);
  g.fill();
}

export function donutDrop() {
  openDialog(
    'Donut Drop',
    html`<p class="dialog-lead">Catch donuts and sprinkles in your box. Golden donuts start a 2× Sugar Rush. Dodge the burnt ones and the cheeky seagulls! <span class="hint">Drag, or use ← → / A D.</span></p>
      <div class="drop-wrap"><canvas class="drop" id="drop" width="${W}" height="${H}" tabindex="0" aria-label="Donut Drop game. Use left and right arrow keys to move the box."></canvas>
        <div class="drop-over" id="drop-over"><div><b>Donut Drop</b><p>60 seconds · 3 hearts</p><button type="button" class="btn big" id="drop-start">${raw('▶')} Play</button><p class="hint">Best: ${progress.state.dropBest || '—'}</p></div></div></div>
      <div class="actions dialog-actions"><button type="button" class="btn light" data-exp="arcade">Arcade</button><button type="button" class="btn" data-close>Done</button></div>`,
    { variant: 'game', icon: '🕹️', key: 'drop' },
  );
  const canvas = document.getElementById('drop') as HTMLCanvasElement;
  const over = document.getElementById('drop-over')!;
  const g = canvas.getContext('2d')!;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  g.scale(dpr, dpr);

  let items: Item[] = [];
  let gulls: Gull[] = [];
  let fx: Fx[] = [];
  let px = W / 2;
  let target = W / 2;
  let score = 0;
  let lives = 3;
  let time = 60;
  let rush = 0;
  let spawnT = 0;
  let gullT = 6;
  let combo = 0;
  let running = false;
  let raf = 0;
  let last = 0;
  const keys = new Set<string>();

  const bg = () => {
    const sky = g.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#9fd3f4');
    sky.addColorStop(0.65, '#ffe3e8');
    sky.addColorStop(1, '#ffd9c2');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff6d6';
    g.beginPath();
    g.arc(W * 0.78, 110, 42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (const [x, y, s] of [
      [70, 90, 1],
      [260, 60, 0.8],
      [330, 170, 0.7],
    ]) {
      g.beginPath();
      g.ellipse(x, y, 40 * s, 13 * s, 0, 0, Math.PI * 2);
      g.ellipse(x + 22 * s, y - 8 * s, 26 * s, 14 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#8fd3e0';
    g.fillRect(0, GROUND - 40, W, 40);
    g.fillStyle = '#b4ece2';
    g.fillRect(0, GROUND - 12, W, 12);
    g.fillStyle = '#f6e3b8';
    g.fillRect(0, GROUND, W, H - GROUND);
  };

  const spawn = () => {
    const r = Math.random();
    const kind: Kind = r < 0.07 ? 'gold' : r < 0.25 ? 'burnt' : r < 0.5 ? 'sprinkle' : 'donut';
    const speedUp = 1 + (60 - time) / 45;
    items.push({
      kind,
      x: 30 + Math.random() * (W - 60),
      y: -30,
      vy: (110 + Math.random() * 70) * speedUp,
      r: kind === 'sprinkle' ? 14 : 19,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 4,
      hue: FROST[Math.floor(Math.random() * FROST.length)],
    });
  };

  const pop = (x: number, y: number, c: string, text?: string) => {
    for (let i = 0; i < 10; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 220, life: 0.7, c });
    if (text) fx.push({ x, y: y - 10, vx: 0, vy: -60, life: 1, c: '#7d3f59', text });
  };

  const end = () => {
    running = false;
    cancelAnimationFrame(raf);
    const improved = progress.score('dropBest', score);
    over.innerHTML = html`<div><b>${lives > 0 ? 'Time!' : 'Out of hearts'}</b><p>You scored <strong>${score}</strong>${improved && score ? ' · New best! ✨' : ''}</p><button type="button" class="btn big" id="drop-start">Play again</button><p class="hint">Best: ${progress.state.dropBest || '—'}</p></div>`.value;
    over.hidden = false;
    document.getElementById('drop-start')!.onclick = start;
    if (improved && score) {
      sound.success();
      burst();
    } else sound.pop();
    if (score >= 300) toast(`Donut Drop: ${score} points!`, { icon: '🕹️' });
  };

  const frame = (now: number) => {
    if (!dialogOpen('drop')) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time -= dt;
    rush = Math.max(0, rush - dt);
    if (keys.has('left')) target -= 420 * dt;
    if (keys.has('right')) target += 420 * dt;
    target = Math.max(38, Math.min(W - 38, target));
    px += (target - px) * Math.min(1, dt * 16);
    spawnT -= dt;
    if (spawnT <= 0) {
      spawn();
      spawnT = Math.max(0.28, 0.75 - (60 - time) / 120);
    }
    gullT -= dt;
    if (gullT <= 0) {
      gullT = 5 + Math.random() * 4;
      const dir = Math.random() < 0.5 ? 1 : -1;
      gulls.push({ x: dir > 0 ? -40 : W + 40, y: GROUND - 40, vx: dir * 190, t: 0, hit: false });
    }
    bg();
    // items
    for (const it of items) {
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
      const caught = it.y > GROUND - 46 && it.y < GROUND - 10 && Math.abs(it.x - px) < 46;
      if (caught) {
        it.y = H + 99;
        if (it.kind === 'burnt') {
          lives--;
          combo = 0;
          sound.error();
          pop(it.x, GROUND - 40, '#5a3a2e', '−♥');
        } else {
          combo++;
          const base = it.kind === 'gold' ? 50 : it.kind === 'donut' ? 10 : 5;
          const pts = base * (rush > 0 ? 2 : 1) + Math.min(combo, 10);
          score += pts;
          if (it.kind === 'gold') {
            rush = 5;
            sound.golden();
          } else sound.sprinkle(Math.min(combo, 7));
          pop(it.x, GROUND - 40, it.kind === 'gold' ? '#ffd970' : it.hue, `+${pts}`);
        }
      }
      g.save();
      g.translate(it.x, it.y);
      g.rotate(it.rot);
      if (it.kind === 'sprinkle') {
        ['#ff8fc7', '#8fe3ff', '#ffe08a'].forEach((c, k) => {
          g.save();
          g.rotate((k * Math.PI) / 3);
          g.fillStyle = c;
          g.beginPath();
          g.roundRect(-it.r, -3.5, it.r * 2, 7, 3.5);
          g.fill();
          g.restore();
        });
      } else drawDonut(g, it.r, it.hue, it.kind === 'burnt', it.kind === 'gold');
      g.restore();
    }
    items = items.filter((it) => it.y < H + 40);
    // gulls
    for (const gl of gulls) {
      gl.x += gl.vx * dt;
      gl.t += dt;
      const y = gl.y + Math.sin(gl.t * 6) * 10;
      if (!gl.hit && Math.abs(gl.x - px) < 44 && y > GROUND - 70) {
        gl.hit = true;
        lives--;
        combo = 0;
        score = Math.max(0, score - 15);
        sound.error();
        pop(px, GROUND - 50, '#ffffff', 'Squawk! −15');
      }
      g.save();
      g.translate(gl.x, y);
      g.scale(Math.sign(gl.vx), 1);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2);
      g.fill();
      const flap = Math.sin(gl.t * 14) * 10;
      g.beginPath();
      g.moveTo(-4, -2);
      g.quadraticCurveTo(-14, -18 - flap, -24, -6 - flap);
      g.lineTo(2, -2);
      g.fill();
      g.fillStyle = '#ffb347';
      g.beginPath();
      g.moveTo(17, -1);
      g.lineTo(26, 2);
      g.lineTo(17, 4);
      g.fill();
      g.fillStyle = '#3d3346';
      g.beginPath();
      g.arc(11, -3, 1.8, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    gulls = gulls.filter((gl) => gl.x > -80 && gl.x < W + 80);
    // the box
    g.save();
    g.translate(px, GROUND - 22);
    g.fillStyle = rush > 0 ? '#ffd970' : '#f6a7bf';
    g.beginPath();
    g.roundRect(-44, -18, 88, 36, 8);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(-44, -18, 88, 6);
    g.fillStyle = '#7d3f59';
    g.font = '700 11px system-ui';
    g.textAlign = 'center';
    g.fillText("DANI'S DONUTS", 0, 7);
    g.restore();
    // fx
    for (const f of fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 400 * dt * (f.text ? 0 : 1);
      g.globalAlpha = Math.max(0, f.life);
      if (f.text) {
        g.fillStyle = f.c;
        g.font = '800 18px system-ui';
        g.textAlign = 'center';
        g.fillText(f.text, f.x, f.y);
      } else {
        g.fillStyle = f.c;
        g.fillRect(f.x - 3, f.y - 3, 6, 6);
      }
      g.globalAlpha = 1;
    }
    fx = fx.filter((f) => f.life > 0);
    // HUD
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.roundRect(10, 10, W - 20, 40, 14);
    g.fill();
    g.fillStyle = '#3a3550';
    g.font = '700 18px system-ui';
    g.textAlign = 'left';
    g.fillText(`🍩 ${score}`, 22, 37);
    g.textAlign = 'center';
    g.fillText(rush > 0 ? `SUGAR RUSH ×2  ${Math.ceil(rush)}` : `${Math.ceil(Math.max(0, time))}s`, W / 2, 37);
    g.textAlign = 'right';
    g.fillStyle = '#e4577f';
    g.fillText('♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives)), W - 22, 37);
    if (time <= 0 || lives <= 0) end();
  };

  const start = () => {
    items = [];
    gulls = [];
    fx = [];
    score = 0;
    lives = 3;
    time = 60;
    rush = 0;
    combo = 0;
    gullT = 6;
    spawnT = 0;
    px = target = W / 2;
    over.hidden = true;
    running = true;
    sound.unlock();
    sound.click();
    canvas.focus();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  };
  document.getElementById('drop-start')!.onclick = start;
  const toCanvasX = (clientX: number) => {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };
  canvas.addEventListener('pointerdown', (e) => {
    target = toCanvasX(e.clientX);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (running && (e.pointerType === 'mouse' || e.buttons)) target = toCanvasX(e.clientX);
  });
  canvas.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.add('left');
    if (['ArrowRight', 'KeyD'].includes(e.code)) keys.add('right');
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  canvas.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.delete('left');
    if (['ArrowRight', 'KeyD'].includes(e.code)) keys.delete('right');
  });
  bg();
}

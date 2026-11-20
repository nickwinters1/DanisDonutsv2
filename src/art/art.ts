/* Procedural SVG art: donuts, donut characters, crystals and attraction illustrations.
 * Everything is generated in the browser; nothing is downloaded. */
import { FROSTINGS, GEMS } from '../data/catalog';
import type { Frosting, Gem, SprinkleStyle } from '../data/types';
import { hashString, rng } from '../game/layout';

let uid = 0;
const nextId = (p: string) => `${p}${(uid++).toString(36)}`;

const SPRINKLE_COLORS = ['#fff6d1', '#8fd6e0', '#b9a3ee', '#ffffff', '#f2779a', '#ffd36e', '#9fe0b4'];

/** Picks a frosting/sprinkle style for anyone who didn't choose (stable per name). */
export function styleFor(seedText: string, frosting?: Frosting, sprinkles?: SprinkleStyle) {
  const h = hashString(seedText || 'donut');
  const fk = Object.keys(FROSTINGS) as Frosting[];
  const sk: SprinkleStyle[] = ['rainbow', 'stars', 'hearts', 'rainbow'];
  return { frosting: frosting ?? fk[h % fk.length], sprinkles: sprinkles ?? sk[(h >> 4) % sk.length] };
}

function wavyRing(cx: number, cy: number, rFn: (t: number) => number, n = 72) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = rFn(t);
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(t) * r).toFixed(2)} ${(cy + Math.sin(t) * r).toFixed(2)}`;
  }
  return d + 'Z';
}

export interface DonutOpts {
  frosting?: Frosting;
  sprinkles?: SprinkleStyle;
  seed?: string;
  face?: boolean;
  className?: string;
  title?: string;
}

/** A glossy top-down donut. With `face`, it becomes a little Donut character. */
export function donutSVG(o: DonutOpts = {}) {
  const f = FROSTINGS[o.frosting ?? 'strawberry'] ?? FROSTINGS.strawberry;
  const style = o.sprinkles ?? 'rainbow';
  const r = rng(hashString(o.seed ?? f.label + style));
  const id = nextId('d');
  const phase = r() * 6;
  const outer = wavyRing(50, 49, (t) => 37 + Math.sin(t * 7 + phase) * 2.2 + Math.pow(Math.max(0, Math.sin(t * 3 + phase)), 8) * 4.5);
  const inner = wavyRing(50, 49, (t) => 16 + Math.sin(t * 5 + phase) * 1.1, 40);
  let sprinkles = '';
  if (style !== 'plain') {
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2;
      const rr = 21 + r() * 12;
      const x = 50 + Math.cos(a) * rr;
      const y = 49 + Math.sin(a) * rr;
      if (o.face && y < 40 && Math.abs(x - 50) < 16) continue; // keep the face clear
      const c = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
      const rot = Math.round(r() * 180);
      if (style === 'stars') sprinkles += `<path d="M${x} ${y - 3.2}l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="${['#fff1a8', '#ffffff', '#ffd36e'][i % 3]}"/>`;
      else if (style === 'hearts') sprinkles += `<path d="M${x} ${y + 2.4}c-3.6-2.3-4.3-4.2-3.2-5.4 1-1 2.4-.6 3.2.5.8-1.1 2.2-1.5 3.2-.5 1.1 1.2.4 3.1-3.2 5.4z" fill="${['#ff7aa2', '#ffffff', '#ffb3cc'][i % 3]}"/>`;
      else sprinkles += `<rect x="${(x - 3.2).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="6.4" height="2.1" rx="1.05" fill="${c}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
  }
  const face = o.face
    ? `<g class="dface"><ellipse cx="41.5" cy="24.5" rx="2.6" ry="3.4" fill="#3d3346"/><ellipse cx="58.5" cy="24.5" rx="2.6" ry="3.4" fill="#3d3346"/>
       <circle cx="42.4" cy="23.2" r="1" fill="#fff"/><circle cx="59.4" cy="23.2" r="1" fill="#fff"/>
       <ellipse cx="35" cy="29.5" rx="3.4" ry="2" fill="#ff8fae" opacity=".55"/><ellipse cx="65" cy="29.5" rx="3.4" ry="2" fill="#ff8fae" opacity=".55"/>
       <path d="M46.5 29.2q3.5 3.2 7 0" stroke="#8b3f5c" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`
    : '';
  return `<svg class="donut-art ${o.className ?? ''}" viewBox="0 0 100 100" ${o.title ? `role="img" aria-label="${o.title}"` : 'aria-hidden="true"'}>
    <defs>
      <radialGradient id="${id}a" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#f6cf9c"/><stop offset=".6" stop-color="#e2ad72"/><stop offset="1" stop-color="#bf8350"/></radialGradient>
      <radialGradient id="${id}b" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="${f.color}"/><stop offset="1" stop-color="${f.shade}"/></radialGradient>
    </defs>
    <ellipse cx="50" cy="91" rx="31" ry="5.5" fill="#7a4f3c" opacity=".14"/>
    <path d="M50 7a42 42 0 1 1 0 84a42 42 0 1 1 0-84Zm0 29a13 13 0 1 0 0 26a13 13 0 1 0 0-26Z" fill="url(#${id}a)" fill-rule="evenodd"/>
    <path d="${outer}${inner}" fill="url(#${id}b)" fill-rule="evenodd"/>
    <path d="M24 33q8-14 24-17" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none" opacity=".55"/>
    ${sprinkles}
    <circle cx="50" cy="49" r="12.5" fill="none" stroke="#a97154" stroke-width="2" opacity=".35"/>
    ${face}
  </svg>`;
}

/** A Donut avatar for a name (uses their chosen frosting when we have it). */
export function avatarSVG(name: string, frosting?: Frosting, sprinkles?: SprinkleStyle) {
  const s = styleFor(name, frosting, sprinkles);
  return donutSVG({ ...s, seed: name, face: true });
}

export function crystalSVG(gem: Gem = 'amethyst', className = '') {
  const g = GEMS[gem] ?? GEMS.amethyst;
  const id = nextId('c');
  return `<svg class="crystal-svg ${className}" viewBox="0 0 80 100" aria-hidden="true">
    <defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.light}"/><stop offset=".55" stop-color="${g.color}"/><stop offset="1" stop-color="${g.deep}"/></linearGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="${g.color}" stop-opacity=".55"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="40" cy="50" rx="38" ry="44" fill="url(#${id}g)"/>
    <path d="M40 6 64 30 58 72 40 94 21 72 16 30Z" fill="url(#${id}a)" stroke="${g.deep}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M40 6 48 32 40 94 32 32Z" fill="#fff" opacity=".42"/>
    <path d="M16 30 32 32 21 72M64 30 48 32 58 72M32 32h16" fill="none" stroke="#fff" stroke-width=".9" opacity=".6"/>
    <path d="M16 30 32 32 21 72Z" fill="#3c2a6b" opacity=".08"/>
    <path d="M60 6v12M54 12h12" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="22" cy="18" r="1.6" fill="#fff"/>
  </svg>`;
}

/* ───────── attraction illustrations (80×80) ───────── */

const ART: Record<string, () => string> = {
  donut: () => `<svg viewBox="0 0 80 80" aria-hidden="true">
    <path d="M10 36h60v30a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6Z" fill="#f6a7bf"/><path d="M10 36h60v8H10Z" fill="#ee8fac"/>
    <path d="M12 36 22 12h36l10 24Z" fill="#fde0e8" stroke="#f3b9cb" stroke-width="1.5"/>
    <path d="M30 22h20" stroke="#e57fa1" stroke-width="2.4" stroke-linecap="round"/>
    <g transform="translate(16 40) scale(.24)">${inner('strawberry')}</g><g transform="translate(40 40) scale(.24)">${inner('blueberry')}</g>
    <path d="M10 58h60" stroke="#fff" stroke-opacity=".5" stroke-width="2"/></svg>`,
  crystal: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><ellipse cx="40" cy="70" rx="30" ry="6" fill="#cfc6db"/>
    <path d="M40 6 50 22 47 66H33l-3-44Z" fill="#c9b5f5" stroke="#9d86de" stroke-width="1.4"/><path d="M40 6l3 16-3 44-3-44Z" fill="#fff" opacity=".5"/>
    <path d="M22 26l8 10-1 30h-9l-4-28Z" fill="#f8b6d0" stroke="#e08aac" stroke-width="1.4"/><path d="M58 28l7 10-3 28h-9l-1-30Z" fill="#a3e6e3" stroke="#6cc4c0" stroke-width="1.4"/>
    <path d="M62 8v8M58 12h8M14 14v6M11 17h6" stroke="#f2c46d" stroke-width="2" stroke-linecap="round"/></svg>`,
  cards: () => `<svg viewBox="0 0 80 80" aria-hidden="true">
    <g transform="rotate(-16 40 60)"><rect x="18" y="16" width="30" height="44" rx="5" fill="#d9cdfd" stroke="#f2c46d" stroke-width="2.5"/></g>
    <g transform="rotate(14 40 60)"><rect x="32" y="16" width="30" height="44" rx="5" fill="#c8f0f2" stroke="#f2c46d" stroke-width="2.5"/></g>
    <rect x="25" y="12" width="30" height="46" rx="5" fill="#ffd1de" stroke="#f2c46d" stroke-width="2.5"/>
    <path d="M40 23l3 6.4 7 .9-5.1 4.8 1.3 6.9L40 38.6l-6.2 3.4 1.3-6.9-5.1-4.8 7-.9Z" fill="#ffcf5c"/>
    <rect x="30" y="46" width="20" height="3" rx="1.5" fill="#fff" opacity=".8"/></svg>`,
  film: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="8" y="16" width="64" height="44" rx="6" fill="#3a3157"/>
    <rect x="13" y="21" width="54" height="34" rx="3" fill="url(#sunsetgrad)"/>
    <defs><linearGradient id="sunsetgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc3d6"/><stop offset=".6" stop-color="#ffd9a8"/><stop offset="1" stop-color="#8fd3e0"/></linearGradient></defs>
    <circle cx="40" cy="44" r="8" fill="#ffe08a"/><path d="M13 47h54v8H13Z" fill="#7cc6d8"/>
    <path d="M20 64h40M28 60l-6 12M52 60l6 12" stroke="#a8794f" stroke-width="3" stroke-linecap="round"/></svg>`,
  globe: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="38" r="26" fill="#9fd8ea"/>
    <path d="M22 30c6-6 14-4 16 2s-6 8-10 12-8 0-6-6ZM44 20c8 0 14 4 16 12s-4 6-8 4-12-4-10-10ZM46 46c6-2 10 2 8 8s-8 6-10 2Z" fill="#a9dcb0"/>
    <ellipse cx="40" cy="38" rx="31" ry="31" fill="none" stroke="#f2c46d" stroke-width="2.4" transform="rotate(-20 40 38)" stroke-dasharray="120 80"/>
    <path d="M30 68h20M40 64v4" stroke="#c9a0b9" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(52 12)"><path d="M0 12C-6 6-6 0 0-2 6 0 6 6 0 12Z" fill="#e27fa3"/><circle cy="2.5" r="2.2" fill="#fff"/></g></svg>`,
  diary: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M14 14h46a6 6 0 0 1 6 6v46H20a6 6 0 0 1-6-6Z" fill="#f6b791"/>
    <path d="M20 14h40a6 6 0 0 1 6 6v46H26a6 6 0 0 1-6-6Z" fill="#ffd9c2"/><path d="M26 66a6 6 0 0 1-6-6V20" stroke="#e8a27f" stroke-width="2" fill="none"/>
    <path d="M43 50c-8-5-10-9-7.6-12 2-2.4 5.4-1.6 7.6 1 2.2-2.6 5.6-3.4 7.6-1 2.4 3-.4 7-7.6 12Z" fill="#ff7aa2"/>
    <path d="M56 14v16l-4-3-4 3V14" fill="#c9b8ff"/></svg>`,
  gift: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="14" y="34" width="52" height="36" rx="5" fill="#f6a7bf"/>
    <rect x="10" y="26" width="60" height="12" rx="4" fill="#f39db9"/><rect x="36" y="26" width="8" height="44" fill="#fff3c4"/>
    <path d="M40 26c-4-12-18-14-18-6 0 6 12 6 18 6Zm0 0c4-12 18-14 18-6 0 6-12 6-18 6Z" fill="#ffe08a" stroke="#f2c46d" stroke-width="1.5"/>
    <path d="M14 8v6M11 11h6M64 10v5M61.5 12.5h5" stroke="#c9b8ff" stroke-width="2" stroke-linecap="round"/></svg>`,
  sprinkles: () => `<svg viewBox="0 0 80 80" aria-hidden="true">
    ${[0, 1, 2, 3].map((i) => `<rect x="${10 + (i % 2) * 32}" y="${10 + Math.floor(i / 2) * 32}" width="28" height="28" rx="7" fill="${['#fde0e8', '#e6ddfb', '#d6f2ec', '#fff0cf'][i]}" stroke="#fff" stroke-width="2"/>`).join('')}
    <g transform="translate(14 14) scale(.2)">${inner('strawberry')}</g>
    <path d="M51 20l8 6M58 18l-7 8" stroke="#b9a3ee" stroke-width="3" stroke-linecap="round"/>
    <text x="24" y="62" font-family="system-ui" font-weight="800" font-size="16" fill="#c9a0b9">?</text>
    <path d="M52 52l3 3 6-7" stroke="#4fa486" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  gamepad: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M22 8h36a4 4 0 0 1 4 4v58H18V12a4 4 0 0 1 4-4Z" fill="#b9a3ee"/>
    <rect x="24" y="14" width="32" height="24" rx="3" fill="#2c1d59"/><circle cx="40" cy="26" r="6" fill="#e2ad72"/><circle cx="40" cy="25.4" r="5" fill="#ff8fc7"/><circle cx="40" cy="25.4" r="2" fill="#2c1d59"/>
    <path d="M18 44h44v6H18Z" fill="#9d86de"/><circle cx="30" cy="47" r="3" fill="#ff5d8f"/><circle cx="46" cy="47" r="2.2" fill="#ffe08a"/><circle cx="53" cy="47" r="2.2" fill="#8ff0ff"/>
    <rect x="22" y="8" width="36" height="3" fill="#ffe08a"/></svg>`,
};

function inner(fr: Frosting) {
  const f = FROSTINGS[fr];
  return `<circle cx="50" cy="50" r="42" fill="#e2ad72"/><circle cx="50" cy="48" r="37" fill="${f.color}"/><circle cx="50" cy="49" r="13" fill="#fff7f1"/>
    <g stroke-width="5" stroke-linecap="round"><path d="M26 32l7 3M66 60l6 3M30 66l5-6M64 30l5-4" stroke="#fff6d1"/><path d="M50 18l-4 6M74 46l7 1M22 52l-7 1" stroke="#8fd6e0"/></g>`;
}

export function attractionArt(icon: string) {
  return (ART[icon] ?? ART.donut)();
}

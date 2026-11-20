/* A hand-drawn-style top-down map of Donut Island, generated from the same layout the 3D world
 * uses. Pins are real HTML buttons (keyboard + screen-reader friendly). */
import { ZONES } from '../data/catalog';
import type { Category } from '../data/types';
import { DOCK, GLOBE, ISLET, LANDMARKS, LANTERNS, PALMS, PATHS, PLAZA, STONES, grassEdge, outline } from '../game/layout';
import { esc } from './dom';

const MIN_X = -46;
const MAX_X = 54;
const MIN_Z = -31;
const MAX_Z = 33;
const W = MAX_X - MIN_X;
const H = MAX_Z - MIN_Z;

const pt = (p: { x: number; z: number }) => `${(p.x - MIN_X).toFixed(2)},${(p.z - MIN_Z).toFixed(2)}`;
function smoothPath(pts: { x: number; z: number }[]) {
  // closed Catmull-Rom → cubic Bézier for a soft coastline
  const n = pts.length;
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, z: p1.z + (p2.z - p0.z) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, z: p2.z - (p3.z - p1.z) / 6 };
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + 'Z';
}

let svgCache = '';
function islandSVG() {
  if (svgCache) return svgCache;
  const lagoon = smoothPath(outline(() => 1.07, 96));
  const sand = smoothPath(outline(() => 1, 96));
  const grass = smoothPath(outline((t) => grassEdge(t) - 0.01, 96));
  const paths = PATHS.map((p) => `<polyline points="${p.pts.map(pt).join(' ')}" />`).join('');
  const palms = PALMS.filter((p) => p.x > MIN_X && p.x < MAX_X)
    .map((p) => {
      const [x, y] = pt(p).split(',');
      // a palm seen from above: five soft leaves around a coconut
      return `<g transform="translate(${x} ${y}) rotate(${Math.round(p.dir * 57)})"><ellipse rx="1.25" ry=".5" cx="1" /><ellipse rx="1.25" ry=".5" cx="1" transform="rotate(72)" /><ellipse rx="1.25" ry=".5" cx="1" transform="rotate(144)" /><ellipse rx="1.25" ry=".5" cx="1" transform="rotate(216)" /><ellipse rx="1.25" ry=".5" cx="1" transform="rotate(288)" /><circle r=".42" fill="#b88d72" /></g>`;
    })
    .join('');
  const lanterns = LANTERNS.map((l) => {
    const [x, y] = pt(l).split(',');
    return `<circle class="m-lantern" data-lantern="${l.id}" cx="${x}" cy="${y}" r=".75" />`;
  }).join('');
  const stones = STONES.map((s) => {
    const [x, y] = pt(s).split(',');
    return `<circle cx="${x}" cy="${y}" r="${s.r}" fill="#cfc6db" />`;
  }).join('');
  const [ix, iy] = pt(ISLET).split(',');
  const [px, py] = pt(PLAZA).split(',');
  const [gx, gy] = pt(GLOBE).split(',');
  const waves = Array.from({ length: 14 }, (_, i) => {
    const x = (i * 37) % W;
    const y = ((i * 23) % (H - 6)) + 3;
    return `<path d="M${x} ${y}q1.5-1 3 0t3 0" />`;
  }).join('');
  svgCache = `<svg class="imap-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <radialGradient id="imap-sea" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#bdeef0"/><stop offset="1" stop-color="#8dd2e3"/></radialGradient>
      <radialGradient id="imap-hill" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#86c486"/><stop offset="1" stop-color="#a7d79a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" rx="5" fill="url(#imap-sea)"/>
    <g fill="none" stroke="#e9fbff" stroke-width=".35" stroke-linecap="round" opacity=".8">${waves}</g>
    <path d="${lagoon}" fill="#b4ece2"/>
    <ellipse cx="${ix}" cy="${iy}" rx="${ISLET.r + 1.4}" ry="${ISLET.r + 1}" fill="#b4ece2"/>
    <path d="${sand}" fill="#f6e3b8" stroke="#fff6e3" stroke-width=".6"/>
    <path d="${grass}" fill="#a7d79a"/>
    <circle cx="${pt({ x: 11, z: 11 }).split(',')[0]}" cy="${pt({ x: 11, z: 11 }).split(',')[1]}" r="6" fill="url(#imap-hill)"/>
    <g fill="none" stroke="#f4e1bc" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
    <circle cx="${px}" cy="${py}" r="5.4" fill="#f6e7d0"/>
    <circle cx="${px}" cy="${py}" r="2.6" fill="#bfe9ef" stroke="#f3e9f4" stroke-width=".7"/>
    ${lanterns}
    <rect x="${DOCK.x - DOCK.width / 2 - MIN_X}" y="${DOCK.z0 - MIN_Z}" width="${DOCK.width}" height="${DOCK.z1 - DOCK.z0}" rx=".4" fill="#d3a679"/>
    <circle cx="${gx}" cy="${gy}" r="1.1" fill="#9fd8ea" stroke="#f2c46d" stroke-width=".35"/>
    <ellipse cx="${ix}" cy="${iy}" rx="${ISLET.r}" ry="${ISLET.r * 0.85}" fill="#f6e3b8"/>
    <ellipse cx="${ix}" cy="${iy}" rx="${ISLET.r * 0.55}" ry="${ISLET.r * 0.45}" fill="#a7d79a"/>
    ${stones}
    <g fill="#7cc4a0" stroke="#5fa985" stroke-width=".12">${palms}</g>
  </svg>`;
  return svgCache;
}

export interface MapOptions {
  visited: readonly Category[];
  /** player marker (in-game map) */
  player?: { x: number; z: number; heading: number };
  goldenFound?: boolean;
  compact?: boolean;
}

const pct = (p: { x: number; z: number }) => `left:${(((p.x - MIN_X) / W) * 100).toFixed(2)}%;top:${(((p.z - MIN_Z) / H) * 100).toFixed(2)}%`;

export function islandMapHTML(o: MapOptions) {
  const pins = LANDMARKS.map((l) => {
    const z = ZONES.find((zz) => zz.id === l.id)!;
    const done = o.visited.includes(l.id);
    return `<button type="button" class="imap-pin ${done ? 'done' : ''}" style="${pct(l)};--accent:${z.accent}" data-map-zone="${l.id}" aria-label="${esc(z.name)}${done ? ' (visited)' : ''}">
      <span class="imap-dot"><i>${z.icon}</i></span><span class="imap-name">${esc(z.short)}</span>${done ? '<span class="imap-check" aria-hidden="true">✓</span>' : ''}
    </button>`;
  }).join('');
  const extra = `<button type="button" class="imap-pin small" style="${pct(GLOBE)};--accent:#5fb8d4" data-map-zone="worldmap" aria-label="Donuts Around the World globe"><span class="imap-dot"><i>🌎</i></span><span class="imap-name">Globe</span></button>
    <button type="button" class="imap-pin small" style="${pct(PLAZA)};--accent:#e57fa1" data-map-zone="finale" aria-label="The fountain and the grand finale"><span class="imap-dot"><i>⛲</i></span><span class="imap-name">Fountain</span></button>
    <span class="imap-secret ${o.goldenFound ? 'found' : ''}" style="${pct(ISLET)}" aria-hidden="true">${o.goldenFound ? '🏆' : '✦'}</span>`;
  const player = o.player
    ? `<span class="imap-player" style="${pct(o.player)};--rot:${(-o.player.heading * 180) / Math.PI + 180}deg" aria-label="You are here"></span>`
    : '';
  return `<div class="imap ${o.compact ? 'compact' : ''}">${islandSVG()}<div class="imap-pins">${pins}${extra}${player}</div></div>`;
}

/** Lights the plaza lanterns on an already-rendered map. */
export function syncMapLanterns(root: ParentNode, visited: readonly Category[]) {
  root.querySelectorAll<SVGCircleElement>('[data-lantern]').forEach((c) => c.classList.toggle('lit', visited.includes(c.dataset.lantern as Category)));
}

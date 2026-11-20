/* The island's geography as pure math: coastline, heights, destinations, paths, props,
 * colliders and collectibles. The 3D world AND the 2D island map on the page are both
 * generated from this file, so they always agree. Units are roughly metres.
 * x = east, z = south (the camera looks north, toward −z). */
import type { Category } from '../data/types';

export interface V2 {
  x: number;
  z: number;
}

export const RX = 34;
export const RZ = 24;
/** Water deeper than this (below sea level 0) can't be waded through. */
export const WADE_LIMIT = -0.62;

/* ───────── helpers ───────── */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth01 = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const gauss = (dx: number, dz: number, s: number) => Math.exp(-(dx * dx + dz * dz) / (2 * s * s));

function hash2(x: number, z: number) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}
function vnoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    s += a * vnoise(x * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s / 0.9375;
}

/** Deterministic random numbers, so the island is the same for everyone. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ───────── coastline ───────── */

export function wobble(theta: number) {
  return (
    1 +
    0.07 * Math.sin(2 * theta + 0.6) +
    0.05 * Math.sin(3 * theta + 1.9) +
    0.03 * Math.sin(5 * theta + 0.4) +
    0.018 * Math.sin(9 * theta + 2.3)
  );
}

/** Angular distance helper. */
const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Where grass begins, as a fraction of the shore radius. Memory Beach (south-west) gets a wide beach. */
export function grassEdge(theta: number) {
  let e = 0.77;
  e -= 0.15 * Math.exp(-Math.pow(angDist(theta, 2.35) / 0.42, 2)); // SW: Memory Beach
  e -= 0.05 * Math.exp(-Math.pow(angDist(theta, 1.62) / 0.25, 2)); // S: the dock
  e -= 0.06 * Math.exp(-Math.pow(angDist(theta, -1.62) / 0.3, 2)); // N: Crystal Cove sands
  return e;
}

export function polar(x: number, z: number) {
  const nx = x / RX;
  const nz = z / RZ;
  const theta = Math.atan2(nz, nx);
  return { theta, q: Math.hypot(nx, nz) / wobble(theta) };
}

/** Point on the island at normalized radius q along angle theta. */
export function atQ(theta: number, q: number): V2 {
  const r = q * wobble(theta);
  return { x: Math.cos(theta) * r * RX, z: Math.sin(theta) * r * RZ };
}

/* ───────── destinations ───────── */

export interface Landmark {
  id: Category;
  x: number;
  z: number;
  /** rotation.y that makes the landmark's front (+z) face the plaza */
  rot: number;
  /** where you stand to interact */
  entry: V2;
  /** radius of the flattened pad under it */
  pad: number;
}

export const PLAZA: V2 = { x: 0, z: 0 };
export const SPAWN: V2 = { x: 0, z: 6.2 };

/** Max turn away from "facing the camera" (south), so every front stays visible from the default view. */
const MAX_TURN = 1.13;

function landmark(id: Category, x: number, z: number, entryDist: number, pad: number): Landmark {
  // face the plaza, but never turn the front more than ~65° away from the camera
  const rot = clamp(Math.atan2(PLAZA.x - x, PLAZA.z - z), -MAX_TURN, MAX_TURN);
  return { id, x, z, rot, entry: { x: x + Math.sin(rot) * entryDist, z: z + Math.cos(rot) * entryDist }, pad };
}

export const LANDMARKS: Landmark[] = [
  landmark('note', -18.5, -6.5, 4.2, 5.2),
  landmark('letter', -3, -17.6, 3.6, 4.4),
  landmark('clip', 15.5, -9, 3.9, 4.6),
  landmark('card', 21.5, 3, 3.4, 4),
  landmark('capsule', 11, 11, 2.6, 2.6),
  landmark('memory', -17.5, 14.5, 3.6, 4.6),
];
export const landmarkById = (id: Category) => LANDMARKS.find((l) => l.id === id)!;

/** Six lanterns ring the plaza, each one on the path toward its destination. They light up as quests finish. */
export const LANTERNS = LANDMARKS.map((l) => {
  const a = Math.atan2(l.z - PLAZA.z, l.x - PLAZA.x);
  return { id: l.id, x: PLAZA.x + Math.cos(a) * 6.4, z: PLAZA.z + Math.sin(a) * 6.4, angle: a };
});

/* ───────── paths ───────── */

export interface Path {
  id: Category;
  pts: V2[];
}

function bezier(a: V2, b: V2, c: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, z: u * u * a.z + 2 * u * t * b.z + t * t * c.z });
  }
  return out;
}

export const PATHS: Path[] = LANDMARKS.map((l, i) => {
  const a = Math.atan2(l.entry.z - PLAZA.z, l.entry.x - PLAZA.x);
  const start = { x: PLAZA.x + Math.cos(a) * 3.2, z: PLAZA.z + Math.sin(a) * 3.2 };
  const mid = { x: (start.x + l.entry.x) / 2, z: (start.z + l.entry.z) / 2 };
  // bend each path a little so they feel hand-made
  const nx = -(l.entry.z - start.z);
  const nz = l.entry.x - start.x;
  const nl = Math.hypot(nx, nz) || 1;
  const bend = [1.6, -1.4, 1.2, -1.5, 1.1, -1.7][i];
  const ctrl = { x: mid.x + (nx / nl) * bend, z: mid.z + (nz / nl) * bend };
  return { id: l.id, pts: bezier(start, ctrl, l.entry, 14) };
});

function distToSeg(p: V2, a: V2, b: V2) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz || 1));
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}
export function pathDistance(x: number, z: number) {
  let d = Infinity;
  const p = { x, z };
  for (const path of PATHS) for (let i = 0; i < path.pts.length - 1; i++) d = Math.min(d, distToSeg(p, path.pts[i], path.pts[i + 1]));
  return d;
}

/* ───────── the dock, the secret islet and its stepping stones ───────── */

export const ISLET = { x: 47.5, z: -11.5, r: 3.4 };

/** Finds where the shore crosses sea level walking south along x. */
function shoreSouth(x: number) {
  for (let z = 10; z < 40; z += 0.05) if (baseHeight(x, z) < 0) return z;
  return 24;
}
export const DOCK = (() => {
  const x = 4.5;
  const z0 = shoreSouth(x) - 2.2;
  return { x, z0, z1: z0 + 10, width: 2.2, deckY: 0.55 };
})();
export const GLOBE: V2 = { x: DOCK.x + 3.4, z: DOCK.z0 - 1.2 };

function isletHeight(x: number, z: number) {
  const d = Math.hypot(x - ISLET.x, (z - ISLET.z) * 1.15);
  if (d < ISLET.r) return 0.12 + 0.5 * smooth01(1 - d / ISLET.r);
  return 0.12 - 3.6 * smooth01((d - ISLET.r) / 3.2);
}

export interface Stone {
  x: number;
  z: number;
  r: number;
  top: number;
}
export const STONES: Stone[] = (() => {
  // from the east shore toward the islet
  const start = { x: 0, z: 0 };
  const dir = { x: ISLET.x - 30, z: ISLET.z + 4.5 };
  const dl = Math.hypot(dir.x, dir.z);
  for (let t = 0; t < 30; t += 0.05) {
    const x = 30 + (dir.x / dl) * t;
    const z = -4.5 + (dir.z / dl) * t;
    if (baseHeight(x, z) < WADE_LIMIT - 0.25) {
      start.x = x;
      start.z = z;
      break;
    }
  }
  const out: Stone[] = [];
  for (let i = 0; i < 6; i++) {
    const x = start.x + (dir.x / dl) * (0.5 + i * 2.6);
    const z = start.z + (dir.z / dl) * (0.5 + i * 2.6) + (i % 2 ? 0.35 : -0.35);
    if (Math.hypot(x - ISLET.x, (z - ISLET.z) * 1.15) < ISLET.r + 0.4) break;
    out.push({ x, z, r: 0.85, top: 0.38 + (i % 2) * 0.12 });
  }
  return out;
})();
export const GOLDEN: V2 = { x: ISLET.x + 0.3, z: ISLET.z - 0.4 };

/* ───────── heights ───────── */

export function baseHeight(x: number, z: number): number {
  const { theta, q } = polar(x, z);
  const ge = grassEdge(theta);
  let h: number;
  if (q <= 1) {
    const t = smooth01((1 - q) / (1 - ge + 0.1));
    h = 0.04 + 0.98 * t;
    h += (fbm(x * 0.07 + 3.1, z * 0.07 - 1.7) - 0.5) * 0.55 * smooth01((ge - q) / 0.18);
  } else {
    const d = q - 1;
    h = 0.04 - 0.66 * smooth01(d / 0.07) - 3.4 * smooth01((d - 0.05) / 0.26);
  }
  h += 2.15 * gauss(x - 11, z - 11, 4.6) * smooth01((1.02 - q) / 0.2); // the treasure hill
  h += 0.75 * gauss(x - 17, z + 15, 5.5) * smooth01((1 - q) / 0.2);
  h += 0.55 * gauss(x + 24, z + 1, 4.5) * smooth01((1 - q) / 0.2);
  return Math.max(h, isletHeight(x, z));
}

interface Flat {
  x: number;
  z: number;
  r: number;
  f: number;
  h: number;
}
const FLATS: Flat[] = [
  { x: PLAZA.x, z: PLAZA.z, r: 8, f: 3.5, h: 0 },
  ...LANDMARKS.map((l) => ({ x: l.x, z: l.z, r: l.pad, f: 2.6, h: 0 })),
  { x: GLOBE.x, z: GLOBE.z, r: 1.6, f: 1.5, h: 0 },
].map((f) => ({ ...f, h: baseHeight(f.x, f.z) }));
// The plaza sits a touch higher so the fountain reads as the island's heart.
FLATS[0].h = Math.max(FLATS[0].h, 1.08);

/** Ground height of the island itself (terrain only). */
export function terrainHeight(x: number, z: number): number {
  let h = baseHeight(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r + f.f) {
      const t = 1 - smooth01((d - f.r) / f.f);
      h += (f.h - h) * t;
    }
  }
  return h;
}

/** Height you stand on: terrain, the dock deck or a stepping stone. */
export function groundHeight(x: number, z: number): number {
  let h = terrainHeight(x, z);
  if (onDock(x, z)) h = Math.max(h, DOCK.deckY);
  for (const s of STONES) if (Math.hypot(x - s.x, z - s.z) < s.r) h = Math.max(h, s.top);
  return h;
}

export function onDock(x: number, z: number) {
  return Math.abs(x - DOCK.x) < DOCK.width / 2 && z > DOCK.z0 - 0.4 && z < DOCK.z1;
}

export function walkable(x: number, z: number) {
  return groundHeight(x, z) > WADE_LIMIT;
}

/* ───────── props (deterministic) ───────── */

export interface Collider {
  x: number;
  z: number;
  r: number;
}

function clearOfFeatures(x: number, z: number, margin: number) {
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 9 + margin) return false;
  for (const l of LANDMARKS) if (Math.hypot(x - l.x, z - l.z) < l.pad + 1.5 + margin) return false;
  if (pathDistance(x, z) < 1.6 + margin) return false;
  if (x > DOCK.x - 3 - margin && x < DOCK.x + 6 + margin && z > DOCK.z0 - 4 - margin) return false;
  if (Math.hypot(x - GLOBE.x, z - GLOBE.z) < 2 + margin) return false;
  return true;
}

export interface Palm {
  x: number;
  z: number;
  h: number;
  lean: number;
  dir: number;
  s: number;
}
export const PALMS: Palm[] = (() => {
  const r = rng(7);
  const out: Palm[] = [];
  let tries = 0;
  while (out.length < 26 && tries++ < 4000) {
    const theta = r() * Math.PI * 2;
    const inland = r() < 0.14;
    const q = inland ? 0.42 + r() * 0.3 : 0.8 + r() * 0.14;
    const p = atQ(theta, q);
    if (!clearOfFeatures(p.x, p.z, 0.4)) continue;
    if (out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 4.2)) continue;
    if (terrainHeight(p.x, p.z) < 0.15) continue;
    // lean outward, toward the sea
    const out2 = Math.atan2(p.z / RZ, p.x / RX);
    out.push({ x: p.x, z: p.z, h: 4.2 + r() * 1.6, lean: 0.12 + r() * 0.2, dir: out2 + (r() - 0.5) * 0.8, s: 0.85 + r() * 0.3 });
  }
  // a palm for the treasure chest and the islet
  out.push({ x: 13.4, z: 9.4, h: 4.6, lean: 0.18, dir: -0.6, s: 1 });
  out.push({ x: ISLET.x + 1.6, z: ISLET.z + 0.9, h: 4, lean: 0.24, dir: 0.4, s: 0.9 });
  return out;
})();

export interface Rock {
  x: number;
  z: number;
  s: number;
  seed: number;
}
export const ROCKS: Rock[] = (() => {
  const r = rng(21);
  const out: Rock[] = [];
  let tries = 0;
  while (out.length < 26 && tries++ < 3000) {
    const theta = r() * Math.PI * 2;
    if (angDist(theta, 2.35) < 0.5 || angDist(theta, 1.62) < 0.3) continue; // keep Memory Beach + dock clear
    const p = atQ(theta, 0.96 + r() * 0.1);
    if (!clearOfFeatures(p.x, p.z, 0)) continue;
    if (out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 3)) continue;
    out.push({ x: p.x, z: p.z, s: 0.5 + r() * 0.9, seed: r() * 1000 });
  }
  return out;
})();

export interface Bush {
  x: number;
  z: number;
  s: number;
  hue: number;
}
export const BUSHES: Bush[] = (() => {
  const r = rng(99);
  const out: Bush[] = [];
  let tries = 0;
  while (out.length < 22 && tries++ < 4000) {
    const theta = r() * Math.PI * 2;
    const q = 0.3 + r() * 0.42;
    const p = atQ(theta, q);
    if (q > grassEdge(theta) - 0.05) continue;
    if (!clearOfFeatures(p.x, p.z, 0.3)) continue;
    if ([...out, ...PALMS].some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 3)) continue;
    out.push({ x: p.x, z: p.z, s: 0.7 + r() * 0.6, hue: r() });
  }
  return out;
})();

/** Static obstacles the player can't walk through. Landmarks add their own (see LANDMARK_COLLIDERS). */
export const COLLIDERS: Collider[] = [
  { x: PLAZA.x, z: PLAZA.z, r: 2.75 }, // fountain basin
  ...LANTERNS.map((l) => ({ x: l.x, z: l.z, r: 0.28 })),
  ...PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.42 })),
  ...ROCKS.filter((r) => r.s > 0.7).map((r) => ({ x: r.x, z: r.z, r: r.s * 0.8 })),
  ...BUSHES.map((b) => ({ x: b.x, z: b.z, r: b.s * 0.75 })),
  { x: GLOBE.x, z: GLOBE.z, r: 0.75 },
];

/** Footprints of each destination's buildings, relative to the landmark and its rotation. */
const LOCAL_COLLIDERS: Record<Category, Collider[]> = {
  note: [
    { x: -1.6, z: -0.7, r: 2.1 },
    { x: 1.6, z: -0.7, r: 2.1 },
    { x: -3.6, z: 2.3, r: 0.7 },
    { x: 3.6, z: 2.3, r: 0.7 },
  ],
  letter: [
    { x: 0, z: -0.8, r: 1.6 },
    { x: -2.6, z: -0.2, r: 1.1 },
    { x: 2.7, z: -0.4, r: 1.2 },
    { x: -1.4, z: -2.4, r: 1.2 },
    { x: 1.5, z: -2.4, r: 1.2 },
  ],
  clip: [
    { x: -1.4, z: -0.6, r: 1.9 },
    { x: 1.4, z: -0.6, r: 1.9 },
    { x: -2.6, z: 1.9, r: 0.55 },
    { x: 2.6, z: 1.9, r: 0.55 },
  ],
  card: [
    { x: 0, z: -0.3, r: 1.5 },
    { x: -1.9, z: 0.9, r: 0.25 },
    { x: 1.9, z: 0.9, r: 0.25 },
    { x: -1.9, z: -1.4, r: 0.25 },
    { x: 1.9, z: -1.4, r: 0.25 },
  ],
  capsule: [{ x: 0, z: 0, r: 0.95 }],
  memory: [
    { x: 0, z: -0.4, r: 0.45 },
    { x: -2.6, z: 1, r: 0.7 },
    { x: 2.7, z: -1.6, r: 0.9 },
  ],
};

export const LANDMARK_COLLIDERS: Collider[] = LANDMARKS.flatMap((l) =>
  LOCAL_COLLIDERS[l.id].map((c) => {
    const cos = Math.cos(l.rot);
    const sin = Math.sin(l.rot);
    return { x: l.x + c.x * cos + c.z * sin, z: l.z - c.x * sin + c.z * cos, r: c.r };
  }),
);

export const ALL_COLLIDERS: Collider[] = [...COLLIDERS, ...LANDMARK_COLLIDERS];

export function blocked(x: number, z: number, radius: number) {
  for (const c of ALL_COLLIDERS) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + radius) ** 2) return true;
  return false;
}

/* ───────── collectibles ───────── */

export const SPRINKLE_SPOTS: V2[] = (() => {
  const out: V2[] = [];
  const ok = (p: V2) => walkable(p.x, p.z) && !blocked(p.x, p.z, 0.45) && !out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 1.2);
  // trails along each path
  PATHS.forEach((path, pi) => {
    [0.22, 0.42, 0.62, 0.82].forEach((t, k) => {
      const i = Math.floor(t * (path.pts.length - 1));
      const a = path.pts[i];
      const b = path.pts[i + 1];
      const nx = -(b.z - a.z);
      const nz = b.x - a.x;
      const nl = Math.hypot(nx, nz) || 1;
      const side = (k + pi) % 2 ? 0.55 : -0.55;
      const p = { x: a.x + (nx / nl) * side, z: a.z + (nz / nl) * side };
      if (ok(p)) out.push(p);
    });
  });
  // a ring around the fountain, between the lanterns
  LANTERNS.forEach((l, i) => {
    const a = l.angle + Math.PI / 6;
    const p = { x: PLAZA.x + Math.cos(a) * 4.6, z: PLAZA.z + Math.sin(a) * 4.6 };
    if (ok(p) && i < 6) out.push(p);
  });
  // little secrets: behind buildings, on the beaches, up the hill, at the end of the dock
  const r = rng(404);
  const extras: V2[] = [
    { x: DOCK.x, z: DOCK.z1 - 0.8 },
    { x: DOCK.x, z: DOCK.z1 - 3.2 },
    { x: 11.2, z: 8.2 },
    ...LANDMARKS.map((l) => ({ x: l.x - Math.sin(l.rot) * (l.pad + 1.6), z: l.z - Math.cos(l.rot) * (l.pad + 1.6) })),
    ...STONES.slice(1, 3).map((s) => ({ x: s.x, z: s.z })),
  ];
  for (const p of extras) if (out.length < 40 && ok(p)) out.push(p);
  let tries = 0;
  while (out.length < 40 && tries++ < 5000) {
    const theta = r() * Math.PI * 2;
    const p = atQ(theta, 0.55 + r() * 0.4);
    if (ok(p) && terrainHeight(p.x, p.z) > 0.1 && pathDistance(p.x, p.z) > 2.5) out.push(p);
  }
  return out.slice(0, 40);
})();

/** Shallow-water spots where messages in bottles wash up. */
export const BOTTLE_SPOTS: V2[] = (() => {
  const out: V2[] = [];
  for (let i = 0; i < 18; i++) {
    const theta = (i / 18) * Math.PI * 2 + 0.17;
    if (angDist(theta, 1.62) < 0.18 || angDist(theta, -1.62) < 0.2) continue;
    // walk outward until the water is ankle-deep
    for (let q = 0.95; q < 1.2; q += 0.004) {
      const p = atQ(theta, q);
      const h = terrainHeight(p.x, p.z);
      if (h < -0.16) {
        if (h > WADE_LIMIT + 0.1 && !blocked(p.x, p.z, 0.6)) out.push(p);
        break;
      }
    }
  }
  return out;
})();

/* ───────── outlines for the 2D map ───────── */

export function outline(qFn: (theta: number) => number, n = 160): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    pts.push(atQ(theta, qFn(theta)));
  }
  return pts;
}

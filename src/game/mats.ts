/* Shared palette, cached materials and small geometry helpers for the island. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  sand: '#f6e3b8',
  sandWet: '#e3c896',
  sandDeep: '#d6c39b',
  grass: '#a7d79a',
  grass2: '#93cd8e',
  grass3: '#bfe3a5',
  path: '#f4e1bc',
  rock: '#cfc6db',
  rock2: '#b8afc8',
  trunk: '#c9a07a',
  trunkDark: '#a97f5e',
  leaf: '#7cc4a0',
  leaf2: '#9bd8b2',
  cream: '#fff3e4',
  creamDark: '#f1dcc5',
  pink: '#f4a7c0',
  pinkDeep: '#e27fa3',
  berry: '#b05c80',
  lav: '#cbb8f2',
  lavDeep: '#9d86de',
  mint: '#a9e3cf',
  butter: '#ffe2a0',
  peach: '#ffc9a8',
  sky: '#9fd3f4',
  white: '#fffaf5',
  wood: '#d3a679',
  woodDark: '#a8794f',
  gold: '#f2c46d',
  dough: '#e2ad72',
  doughDark: '#c88c52',
  ink: '#3d3346',
};

const lambertCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: string, opts: { emissive?: string; emissiveIntensity?: number; side?: THREE.Side } = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? ''}|${opts.side ?? ''}`;
  let m = lambertCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, side: opts.side ?? THREE.FrontSide });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    lambertCache.set(key, m);
  }
  return m;
}

const glossCache = new Map<string, THREE.MeshPhongMaterial>();
/** Glossy, yummy surfaces: icing, glazes, the arcade cabinets, the chest's gold. */
export function gloss(color: string, shininess = 70, specular = 0.35) {
  const key = `${color}|${shininess}|${specular}`;
  let m = glossCache.get(key);
  if (!m) {
    m = new THREE.MeshPhongMaterial({ color, shininess, specular: new THREE.Color(specular, specular, specular) });
    glossCache.set(key, m);
  }
  return m;
}

export const vertexColorMat = new THREE.MeshLambertMaterial({ vertexColors: true });

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadows: 'cast' | 'receive' | 'both' | 'none' = 'both') {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows === 'cast' || shadows === 'both';
  m.receiveShadow = shadows === 'receive' || shadows === 'both';
  return m;
}

export const rbox = (w: number, h: number, d: number, r = 0.12, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));

/** Paints one flat color into a geometry's vertex colors (so several can be merged into one draw call). */
export function tint(geo: THREE.BufferGeometry, color: string | THREE.Color) {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Merges geometries that all carry vertex colors into one (non-indexed for safety). */
export function merge(geos: THREE.BufferGeometry[], keep: string[] = ['position', 'normal', 'color']) {
  const prepared = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    // keep only the attributes every piece has
    for (const name of Object.keys(ng.attributes)) if (!keep.includes(name)) ng.deleteAttribute(name);
    return ng;
  });
  const out = mergeGeometries(prepared, false);
  if (!out) throw new Error('merge failed');
  return out;
}

/** Applies position/rotation/scale to a geometry in place. */
export function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  const sc = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  m.compose(new THREE.Vector3(x, y, z), q, sc);
  geo.applyMatrix4(m);
  return geo;
}

/** A soft round sprite texture (for glows, particles, blob shadows). */
let softTex: THREE.Texture | null = null;
export function softCircle() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  softTex.colorSpace = THREE.SRGBColorSpace;
  return softTex;
}

/** Blob shadow under characters and props: cheap and very cute. */
const shadowMat = new THREE.MeshBasicMaterial({ color: '#5b5470', transparent: true, opacity: 0.22, depthWrite: false });
let shadowGeo: THREE.PlaneGeometry | null = null;
export function blobShadow(size = 1) {
  if (!shadowGeo) {
    shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
  }
  const m = new THREE.Mesh(shadowGeo, shadowMat.clone());
  (m.material as THREE.MeshBasicMaterial).alphaMap = softCircle();
  m.scale.setScalar(size);
  m.renderOrder = 1;
  return m;
}

/** Text drawn into a canvas texture, for painted signs. */
export function signTexture(text: string, opts: { bg?: string; fg?: string; w?: number; h?: number; font?: string; border?: string } = {}) {
  const w = opts.w ?? 512;
  const h = opts.h ?? 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = opts.bg ?? '#fff6ea';
  const r = h * 0.28;
  g.beginPath();
  g.roundRect(6, 6, w - 12, h - 12, r);
  g.fill();
  if (opts.border) {
    g.lineWidth = 10;
    g.strokeStyle = opts.border;
    g.stroke();
  }
  g.fillStyle = opts.fg ?? '#9b4f70';
  g.font = opts.font ?? `700 ${Math.round(h * 0.46)}px "Fredoka Variable", "DM Sans Variable", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.03);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

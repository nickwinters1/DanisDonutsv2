/* Island dressing: palms (merged, swaying in the breeze), rocks, bushes, flowers, grass tufts,
 * shells and starfish, distant islets, a sailboat, seagulls, butterflies and night fireflies. */
import * as THREE from 'three';
import { PAL, merge, softCircle, tint } from '../mats';
import {
  BUSHES,
  PALMS,
  PLAZA,
  ROCKS,
  atQ,
  blocked,
  grassEdge,
  pathDistance,
  polar,
  rng,
  terrainHeight,
  LANDMARKS,
  DOCK,
  type Palm,
} from '../layout';

/* ───────── wind ───────── */

export const wind = { uTime: { value: 0 } };

/** Lambert material whose vertices sway by their `sway` attribute (0 = rooted, 1 = free). */
function swayMaterial(side: THREE.Side = THREE.FrontSide, flat = false) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side, flatShading: flat });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; attribute float sway; attribute float phase;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float w = sway * sway;
        transformed.x += (sin(uTime * 1.25 + phase) * 0.11 + sin(uTime * 2.9 + phase * 1.7) * 0.035) * w;
        transformed.z += (cos(uTime * 1.05 + phase * 1.3) * 0.08) * w;
        transformed.y += sin(uTime * 2.2 + phase) * 0.03 * w;`,
      );
  };
  return m;
}

function addSway(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3) => number, phase: number) {
  const pos = geo.attributes.position;
  const sway = new Float32Array(pos.count);
  const ph = new Float32Array(pos.count).fill(phase);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    sway[i] = fn(v);
  }
  geo.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  return geo;
}

/* ───────── palms ───────── */

function leafGeometry(len: number, width: number, droop: number, colA: THREE.Color, colB: THREE.Color) {
  const n = 9;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = len * t;
    const y = 0.42 * t - droop * t * t;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02 + 0.02)), 0.7) * (1 - t * 0.3);
    pos.push(x, y - w * 0.22, -w, x, y + 0.06, 0, x, y - w * 0.22, w);
    col.push(colB.r, colB.g, colB.b, colA.r, colA.g, colA.b, colB.r, colB.g, colB.b);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function palmParts(p: Palm, seed: number, base: THREE.Vector3) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const h = p.h * p.s;
  const dx = Math.cos(p.dir);
  const dz = Math.sin(p.dir);
  const curve = (t: number) => new THREE.Vector3(dx * p.lean * h * t * t, h * t, dz * p.lean * h * t * t);
  const phase = r() * 10;
  const swayFn = (v: THREE.Vector3) => Math.min(1, Math.max(0, (v.y - base.y) / h)) * 0.55;
  const segs = 7;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < segs; i++) {
    const a = curve(i / segs);
    const b = curve((i + 1) / segs);
    const r0 = (0.3 - 0.12 * (i / segs)) * p.s;
    const r1 = (0.3 - 0.12 * ((i + 1) / segs)) * p.s;
    const g = new THREE.CylinderGeometry(r1, r0 * 1.12, a.distanceTo(b) * 1.06, 7, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize()));
    const mid = a.add(b).multiplyScalar(0.5).add(base);
    g.translate(mid.x, mid.y, mid.z);
    tint(g, i % 2 ? PAL.trunk : PAL.trunkDark);
    parts.push(addSway(g, swayFn, phase));
  }
  const top = curve(1).add(base);
  for (let k = 0; k < 3; k++) {
    const g = new THREE.SphereGeometry(0.17 * p.s, 8, 6);
    const a = (k / 3) * Math.PI * 2;
    g.translate(top.x + Math.cos(a) * 0.18, top.y - 0.12, top.z + Math.sin(a) * 0.18);
    tint(g, '#a7744c');
    parts.push(addSway(g, swayFn, phase));
  }
  const fronds = 8;
  const leafA = new THREE.Color(PAL.leaf);
  const leafB = new THREE.Color(PAL.leaf2);
  const leafC = new THREE.Color('#6fb592');
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + r() * 0.35;
    const g = leafGeometry((2.1 + r() * 0.6) * p.s, 0.5 * p.s, 1.15, f % 2 ? leafA : leafC, leafB);
    g.rotateZ(0.32 - r() * 0.25);
    g.rotateY(ang);
    g.translate(top.x, top.y, top.z);
    parts.push(addSway(g, (v) => Math.min(1, 0.55 + Math.hypot(v.x - top.x, v.z - top.z) * 0.22), phase));
  }
  return parts;
}

/* ───────── rocks & bushes ───────── */

function rockGeometry(s: number, seed: number, colorA: string, colorB: string) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const r = rng(seed);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const jit = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.78 + r() * 0.42);
    v.multiplyScalar(jit.get(key)!);
    pos.setXYZ(i, v.x * s * 1.15, v.y * s * 0.72, v.z * s);
  }
  g.computeVertexNormals();
  const ca = new THREE.Color(colorA);
  const cb = new THREE.Color(colorB);
  const colors = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count / 3; f++) {
    const c = ca.clone().lerp(cb, r());
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function bushParts(x: number, z: number, s: number, hue: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const y = terrainHeight(x, z);
  const greens = ['#8ccf8f', '#7cc488', '#9ed79a', '#86c99a'];
  const n = 3 + Math.floor(r() * 2);
  const blobs: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const rr = i === 0 ? 0 : 0.45 * s;
    const bs = (0.62 + r() * 0.3) * s * (i === 0 ? 1.15 : 1);
    const c = new THREE.Vector3(x + Math.cos(a) * rr, y + bs * 0.75, z + Math.sin(a) * rr);
    blobs.push(c.clone().setY(c.y + bs * 0.3));
    const g = rockGeometry(bs, seed + i * 7, greens[(i + Math.floor(hue * 4)) % 4], greens[(i + 1) % 4]);
    g.translate(c.x, c.y, c.z);
    parts.push(g);
  }
  // a few blossoms
  const blossom = hue < 0.33 ? '#ffb3cc' : hue < 0.66 ? '#fff4c2' : '#e2d2ff';
  for (let k = 0; k < 6; k++) {
    const b = blobs[k % blobs.length];
    const a = r() * Math.PI * 2;
    const g = new THREE.IcosahedronGeometry(0.11 * s, 0);
    g.translate(b.x + Math.cos(a) * 0.5 * s, b.y + r() * 0.25, b.z + Math.sin(a) * 0.5 * s);
    tint(g, blossom);
    parts.push(g);
  }
  return parts;
}

/* ───────── small instanced things ───────── */

function flowerHead() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.075, 6, 4);
    g.scale(1, 0.45, 1);
    g.translate(Math.cos(a) * 0.085, 0, Math.sin(a) * 0.085);
    tint(g, '#ffffff');
    parts.push(g);
  }
  const c = new THREE.SphereGeometry(0.055, 6, 4);
  c.scale(1, 0.6, 1);
  c.translate(0, 0.02, 0);
  tint(c, '#ffe08a');
  parts.push(c);
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.22, 4);
  stem.translate(0, -0.11, 0);
  tint(stem, '#4f9a64');
  parts.push(stem);
  const g = merge(parts);
  g.translate(0, 0.2, 0);
  return g;
}

function tuftGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.ConeGeometry(0.045, 0.42 + (i % 2) * 0.12, 3, 1);
    g.translate(0, 0.2, 0);
    g.rotateZ((i - 2) * 0.22);
    g.rotateY(i * 1.3);
    tint(g, '#ffffff');
    parts.push(g);
  }
  return merge(parts);
}

function starfishGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? 0.07 : 0.2;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ───────── the props group ───────── */

export interface PropsOptions {
  grass: number;
  flowers: number;
}

export class Props {
  readonly group = new THREE.Group();
  readonly boat = new THREE.Group();
  far!: THREE.Mesh;
  private gulls: THREE.Group[] = [];
  private butterflies: { g: THREE.Group; c: THREE.Vector3; ph: number; w: THREE.Mesh[] }[] = [];
  private fireflies: THREE.Points;
  private fireflyMat: THREE.ShaderMaterial;

  constructor(opts: PropsOptions) {
    /* palms */
    const palmGeo = merge(
      PALMS.flatMap((p, i) => palmParts(p, 100 + i, new THREE.Vector3(p.x, terrainHeight(p.x, p.z) - 0.1, p.z))),
      ['position', 'normal', 'color', 'sway', 'phase'],
    );
    const palms = new THREE.Mesh(palmGeo, swayMaterial(THREE.DoubleSide));
    palms.castShadow = true;
    palms.receiveShadow = true;
    this.group.add(palms);

    /* rocks */
    const rockGeo = merge(
      ROCKS.map((rk) => {
        const g = rockGeometry(rk.s, Math.floor(rk.seed), PAL.rock, PAL.rock2);
        g.rotateY(rk.seed);
        g.translate(rk.x, terrainHeight(rk.x, rk.z) + rk.s * 0.15, rk.z);
        return g;
      }),
    );
    const rocks = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.group.add(rocks);

    /* bushes */
    const bushGeo = merge(BUSHES.flatMap((b, i) => bushParts(b.x, b.z, b.s, b.hue, 500 + i * 13)));
    const bushes = new THREE.Mesh(bushGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    bushes.castShadow = true;
    bushes.receiveShadow = true;
    this.group.add(bushes);

    /* flowers + grass tufts */
    const r = rng(77);
    const inGrass = (x: number, z: number, margin: number) => {
      const { theta, q } = polar(x, z);
      if (q > grassEdge(theta) - margin) return false;
      if (pathDistance(x, z) < 1.3) return false;
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 6.6) return false;
      if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < l.pad)) return false;
      if (blocked(x, z, 0.25)) return false;
      return true;
    };
    const dummy = new THREE.Object3D();
    const flowerMesh = new THREE.InstancedMesh(flowerHead(), new THREE.MeshLambertMaterial({ vertexColors: true }), opts.flowers);
    const petal = ['#ffb3cc', '#ffffff', '#e2d2ff', '#ffe3a3', '#ffc7b3', '#c8ecff'].map((h) => new THREE.Color(h));
    let placed = 0;
    let tries = 0;
    while (placed < opts.flowers && tries++ < opts.flowers * 30) {
      // flowers grow in little patches
      const c = atQ(r() * Math.PI * 2, 0.15 + r() * 0.6);
      const color = petal[Math.floor(r() * petal.length)];
      for (let k = 0; k < 5 && placed < opts.flowers; k++) {
        const x = c.x + (r() - 0.5) * 2.6;
        const z = c.z + (r() - 0.5) * 2.6;
        if (!inGrass(x, z, 0.03)) continue;
        dummy.position.set(x, terrainHeight(x, z) - 0.02, z);
        dummy.rotation.set(0, r() * 6.28, 0);
        dummy.scale.setScalar(0.8 + r() * 0.6);
        dummy.updateMatrix();
        flowerMesh.setMatrixAt(placed, dummy.matrix);
        flowerMesh.setColorAt(placed, color);
        placed++;
      }
    }
    flowerMesh.count = placed;
    this.group.add(flowerMesh);

    const tuftMesh = new THREE.InstancedMesh(tuftGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), opts.grass);
    const greens = ['#8ccf86', '#79c27e', '#a2d991', '#6fb67a'].map((h) => new THREE.Color(h));
    placed = 0;
    tries = 0;
    while (placed < opts.grass && tries++ < opts.grass * 20) {
      const p = atQ(r() * Math.PI * 2, Math.sqrt(r()) * 0.8);
      if (!inGrass(p.x, p.z, 0.0)) continue;
      dummy.position.set(p.x, terrainHeight(p.x, p.z) - 0.04, p.z);
      dummy.rotation.set(0, r() * 6.28, 0);
      dummy.scale.set(1 + r() * 0.8, 0.7 + r() * 0.9, 1 + r() * 0.8);
      dummy.updateMatrix();
      tuftMesh.setMatrixAt(placed, dummy.matrix);
      tuftMesh.setColorAt(placed, greens[Math.floor(r() * greens.length)]);
      placed++;
    }
    tuftMesh.count = placed;
    this.group.add(tuftMesh);

    /* shells + starfish on the beaches */
    const beachSpot = () => {
      for (let i = 0; i < 40; i++) {
        const theta = r() * Math.PI * 2;
        const p = atQ(theta, 0.86 + r() * 0.12);
        const h = terrainHeight(p.x, p.z);
        if (h > 0.05 && h < 0.5 && !blocked(p.x, p.z, 0.3) && Math.abs(p.x - DOCK.x) > 2.5) return { ...p, h };
      }
      return null;
    };
    const star = new THREE.InstancedMesh(starfishGeometry(), new THREE.MeshLambertMaterial({ color: '#ffffff' }), 14);
    const shellGeo = new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    shellGeo.scale(1, 0.55, 1.2);
    const shell = new THREE.InstancedMesh(shellGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), 18);
    const starCols = ['#ff9f8f', '#ffb27a', '#f7a1c4'].map((h) => new THREE.Color(h));
    const shellCols = ['#fff1e6', '#ffd9e4', '#ffe7c7', '#efe2ff'].map((h) => new THREE.Color(h));
    for (let i = 0; i < 14; i++) {
      const p = beachSpot();
      if (!p) continue;
      dummy.position.set(p.x, p.h + 0.01, p.z);
      dummy.rotation.set(0, r() * 6.28, 0);
      dummy.scale.setScalar(0.9 + r() * 0.6);
      dummy.updateMatrix();
      star.setMatrixAt(i, dummy.matrix);
      star.setColorAt(i, starCols[i % 3]);
    }
    for (let i = 0; i < 18; i++) {
      const p = beachSpot();
      if (!p) continue;
      dummy.position.set(p.x, p.h, p.z);
      dummy.rotation.set(0, r() * 6.28, 0);
      dummy.scale.setScalar(0.8 + r() * 0.7);
      dummy.updateMatrix();
      shell.setMatrixAt(i, dummy.matrix);
      shell.setColorAt(i, shellCols[i % 4]);
    }
    star.receiveShadow = shell.receiveShadow = true;
    this.group.add(star, shell);

    /* distant islets on the horizon */
    const far: THREE.BufferGeometry[] = [];
    [
      [-150, -120, 16],
      [175, -70, 11],
      [-190, 70, 13],
      [120, 160, 9],
      [60, -190, 14],
    ].forEach(([x, z, s], i) => {
      const base = new THREE.CylinderGeometry(s * 0.8, s * 1.15, 3, 18, 1);
      base.translate(x, 0.2, z);
      tint(base, PAL.sand);
      const top = new THREE.SphereGeometry(s * 0.72, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      top.scale(1, 0.38, 1);
      top.translate(x, 1.6, z);
      tint(top, i % 2 ? '#9fd39b' : '#a9d9a0');
      far.push(base, top);
      for (let k = 0; k < 2; k++)
        far.push(...palmParts({ x, z, h: 5, lean: 0.2, dir: k * 2.4, s: 1.2, }, 900 + i * 3 + k, new THREE.Vector3(x + (k ? 3 : -2), 1.8, z + (k ? -1 : 2))).map((g) => {
          g.deleteAttribute('sway');
          g.deleteAttribute('phase');
          return g;
        }));
    });
    this.far = new THREE.Mesh(merge(far), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.group.add(this.far);

    /* a sailboat drifting past */
    const hull = new THREE.CylinderGeometry(0.9, 0.6, 4.6, 10, 1);
    hull.rotateX(Math.PI / 2);
    hull.scale(1, 0.55, 1);
    tint(hull, '#fff6ee');
    const stripe = new THREE.CylinderGeometry(0.93, 0.93, 3.6, 10, 1, true);
    stripe.rotateX(Math.PI / 2);
    stripe.scale(1, 0.14, 1);
    stripe.translate(0, 0.05, 0);
    tint(stripe, PAL.pinkDeep);
    const mast = new THREE.CylinderGeometry(0.06, 0.08, 5.2, 6);
    mast.translate(0, 2.8, 0);
    tint(mast, PAL.woodDark);
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.9, -1.6, 0, 5.2, 0.05, 0, 0.9, 1.4], 3));
    sail.computeVertexNormals();
    tint(sail, '#fff1f6');
    const sail2 = new THREE.BufferGeometry();
    sail2.setAttribute('position', new THREE.Float32BufferAttribute([0.02, 1.3, 0.2, 0.02, 4.6, 0.2, 0.02, 1.3, 2.2], 3));
    sail2.computeVertexNormals();
    tint(sail2, PAL.pink);
    this.boat.add(new THREE.Mesh(merge([hull, stripe, mast, sail, sail2]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    this.group.add(this.boat);

    /* seagulls */
    const gullMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 3, 6), gullMat);
      body.rotation.x = Math.PI / 2;
      const wingGeo = new THREE.BufferGeometry();
      wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0, 0.18, 1.2, 0.05, -0.05], 3));
      wingGeo.computeVertexNormals();
      const wl = new THREE.Mesh(wingGeo, gullMat);
      const wr = new THREE.Mesh(wingGeo, gullMat);
      wr.scale.x = -1;
      g.add(body, wl, wr);
      g.userData = { wl, wr, a: (i / 4) * Math.PI * 2, r: 22 + i * 7, h: 16 + i * 2.5, s: 0.18 + i * 0.03, ph: i * 1.7 };
      this.gulls.push(g);
      this.group.add(g);
    }

    /* butterflies */
    const wingCols = ['#ffb3cc', '#c9b8ff', '#ffe3a3', '#a9e8de'];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const wingGeo = new THREE.CircleGeometry(0.16, 8);
      wingGeo.scale(1, 0.75, 1);
      wingGeo.translate(0.15, 0, 0);
      const wm = new THREE.MeshLambertMaterial({ color: wingCols[i % 4], side: THREE.DoubleSide, emissive: new THREE.Color(wingCols[i % 4]), emissiveIntensity: 0.25 });
      const w1 = new THREE.Mesh(wingGeo, wm);
      const w2 = new THREE.Mesh(wingGeo, wm);
      w2.scale.x = -1;
      g.add(w1, w2);
      const c = atQ(r() * Math.PI * 2, 0.25 + r() * 0.45);
      this.butterflies.push({ g, c: new THREE.Vector3(c.x, terrainHeight(c.x, c.z) + 0.9, c.z), ph: r() * 10, w: [w1, w2] });
      this.group.add(g);
    }

    /* fireflies (only at night) */
    const fn = 90;
    const fpos = new Float32Array(fn * 3);
    const fseed = new Float32Array(fn);
    for (let i = 0; i < fn; i++) {
      const p = atQ(r() * Math.PI * 2, Math.sqrt(r()) * 0.85);
      fpos.set([p.x, terrainHeight(p.x, p.z) + 0.5 + r() * 1.6, p.z], i * 3);
      fseed[i] = r();
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    fg.setAttribute('seed', new THREE.BufferAttribute(fseed, 1));
    this.fireflyMat = new THREE.ShaderMaterial({
      uniforms: { uTime: wind.uTime, uNight: { value: 0 }, uMap: { value: softCircle() }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime; uniform float uNight; uniform float uScale; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * (0.4 + seed) + seed * 30.0) * 0.8;
          p.y += sin(uTime * (0.7 + seed * 0.5) + seed * 12.0) * 0.35;
          p.z += cos(uTime * (0.35 + seed * 0.6) + seed * 20.0) * 0.8;
          vA = uNight * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.5 + seed * 2.0) + seed * 40.0), 3.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uScale * (34.0 / -mv.z) * (0.7 + seed * 0.6) * 10.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vA;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.93, 0.62), t.a * vA); }`,
    });
    this.fireflies = new THREE.Points(fg, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
  }

  setPointScale(s: number) {
    this.fireflyMat.uniforms.uScale.value = s;
  }

  update(dt: number, time: number, night: number) {
    wind.uTime.value = time;
    this.fireflyMat.uniforms.uNight.value = night;
    this.fireflies.visible = night > 0.02;
    // boat: a slow lap around the island, bobbing
    const ba = time * 0.012 + 2.2;
    this.boat.position.set(Math.cos(ba) * 95, Math.sin(time * 1.3) * 0.15 + 0.2, Math.sin(ba) * 70);
    this.boat.rotation.set(Math.sin(time * 1.1) * 0.05, -ba, Math.sin(time * 0.9) * 0.06);
    for (const g of this.gulls) {
      const u = g.userData as { wl: THREE.Mesh; wr: THREE.Mesh; a: number; r: number; h: number; s: number; ph: number };
      u.a += dt * u.s;
      g.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(time * 0.6 + u.ph) * 1.2, Math.sin(u.a) * u.r * 0.8);
      g.rotation.y = -u.a;
      const flap = Math.sin(time * 5 + u.ph) * 0.45;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
    for (const b of this.butterflies) {
      const t = time * 0.5 + b.ph;
      b.g.position.set(b.c.x + Math.sin(t * 1.3) * 2.2, b.c.y + Math.sin(t * 3.1) * 0.35 + (1 - night) * 0, b.c.z + Math.cos(t * 0.9) * 2.2);
      b.g.rotation.y = Math.atan2(Math.cos(t * 1.3) * 1.3, -Math.sin(t * 0.9) * 0.9);
      const f = Math.sin(time * 18 + b.ph) * 0.9;
      b.w[0].rotation.y = f;
      b.w[1].rotation.y = -f;
      b.g.visible = night < 0.5;
    }
  }
}

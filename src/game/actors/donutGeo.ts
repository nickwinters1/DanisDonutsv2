/* One recipe for every 3D donut on the island: dough, glossy icing with a drippy edge, and
 * sprinkles (rainbow / stars / hearts). Donuts stand upright: the hole faces +z. */
import * as THREE from 'three';
import { merge, tint } from '../mats';
import { rng } from '../layout';
import type { SprinkleStyle } from '../../data/types';

export interface DonutGeos {
  dough: THREE.BufferGeometry;
  icing: THREE.BufferGeometry;
  sprinkles: THREE.BufferGeometry | null;
}

const RAINBOW = ['#fff6d1', '#8fd6e0', '#b9a3ee', '#ffffff', '#f2779a', '#ffd36e', '#9fe0b4'];

export function donutGeos(R: number, tube: number, style: SprinkleStyle | 'none' = 'rainbow', seed = 1, detail = 1): DonutGeos {
  const r = rng(seed);
  const radial = Math.round(14 * detail);
  const tubular = Math.round(36 * detail);
  const dough = new THREE.TorusGeometry(R, tube, radial, tubular);

  const icing = new THREE.TorusGeometry(R, tube * 1.075, radial, tubular);
  const pos = icing.attributes.position as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  const dripPhase = r() * 10;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const u = Math.atan2(p.y, p.x);
    c.set(Math.cos(u) * R, Math.sin(u) * R, 0);
    const o = p.clone().sub(c);
    const nz = o.z / (o.length() || 1);
    // wavy edge with a few long drips
    const drip = Math.pow(Math.max(0, Math.sin(u * 5 + dripPhase)), 6) * 0.55;
    const thr = -0.05 + Math.sin(u * 11 + dripPhase) * 0.09 - drip;
    if (nz < thr) {
      o.multiplyScalar(0.86);
      p.copy(c).add(o);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
  icing.computeVertexNormals();

  let sprinkles: THREE.BufferGeometry | null = null;
  if (style !== 'plain' && style !== 'none') {
    const parts: THREE.BufferGeometry[] = [];
    const count = Math.round(26 * Math.max(0.6, R / 0.5));
    const up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < count; k++) {
      const u = r() * Math.PI * 2;
      const phi = (r() - 0.5) * 1.6; // around the front of the tube
      const cx = Math.cos(u) * R;
      const cy = Math.sin(u) * R;
      const radialDir = new THREE.Vector3(Math.cos(u), Math.sin(u), 0);
      const n = radialDir.multiplyScalar(Math.sin(phi)).add(new THREE.Vector3(0, 0, Math.cos(phi))).normalize();
      const at = new THREE.Vector3(cx, cy, 0).addScaledVector(n, tube * 1.1);
      let g: THREE.BufferGeometry;
      if (style === 'stars') {
        g = new THREE.OctahedronGeometry(tube * 0.12, 0);
        g.scale(1, 1, 0.5);
        tint(g, ['#fff1a8', '#ffffff', '#ffd36e'][k % 3]);
      } else if (style === 'hearts') {
        g = new THREE.SphereGeometry(tube * 0.09, 6, 4);
        g.scale(1.1, 1, 0.6);
        tint(g, ['#ff7aa2', '#ffffff', '#ffb3cc'][k % 3]);
      } else {
        g = new THREE.CapsuleGeometry(tube * 0.045, tube * 0.2, 2, 5);
        tint(g, RAINBOW[k % RAINBOW.length]);
      }
      // lie flat on the icing, random spin
      const q = new THREE.Quaternion().setFromUnitVectors(up, n);
      const spin = new THREE.Quaternion().setFromAxisAngle(n, r() * Math.PI * 2);
      const tangentTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      g.applyQuaternion(tangentTilt);
      g.applyQuaternion(q);
      g.applyQuaternion(spin);
      g.translate(at.x, at.y, at.z);
      parts.push(g);
    }
    sprinkles = merge(parts);
  }
  return { dough, icing, sprinkles };
}

const geoCache = new Map<string, DonutGeos>();
export function cachedDonut(key: string, R: number, tube: number, style: SprinkleStyle | 'none', seed: number, detail = 1) {
  let g = geoCache.get(key);
  if (!g) {
    g = donutGeos(R, tube, style, seed, detail);
    geoCache.set(key, g);
  }
  return g;
}

/** A ready-made donut mesh group. */
export function donutMesh(geos: DonutGeos, doughMat: THREE.Material, icingMat: THREE.Material, sprinkleMat: THREE.Material) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(geos.dough, doughMat);
  const i = new THREE.Mesh(geos.icing, icingMat);
  d.castShadow = i.castShadow = true;
  g.add(d, i);
  if (geos.sprinkles) g.add(new THREE.Mesh(geos.sprinkles, sprinkleMat));
  return g;
}

export const sprinkleMat = new THREE.MeshLambertMaterial({ vertexColors: true });

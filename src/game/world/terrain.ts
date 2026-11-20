/* The island ground: one vertex-coloured mesh (sand, wet sand, grass, paths, plaza tiles)
 * plus a heightmap texture the water shader reads for depth colour and shore foam. */
import * as THREE from 'three';
import { PAL } from '../mats';
import { PLAZA, fbm, grassEdge, pathDistance, polar, smooth01, terrainHeight } from '../layout';

export const BOUNDS = { minX: -64, maxX: 64, minZ: -46, maxZ: 46 };
const W = BOUNDS.maxX - BOUNDS.minX;
const D = BOUNDS.maxZ - BOUNDS.minZ;

const c = (hex: string) => new THREE.Color(hex);
const C = {
  sand: c(PAL.sand),
  wet: c(PAL.sandWet),
  deep: c(PAL.sandDeep),
  lagoon: c('#b9e2d6'),
  grass: c(PAL.grass),
  grass2: c(PAL.grass2),
  grass3: c(PAL.grass3),
  path: c(PAL.path),
  plaza: c('#f6e7d0'),
  plaza2: c('#efdcc2'),
};

export function groundColor(x: number, z: number, h: number, out: THREE.Color) {
  const { theta, q } = polar(x, z);
  if (h < 0.02) {
    // under the water: wet sand fading to a sea-glass tint
    const depth = Math.max(0, -h);
    out.copy(C.wet).lerp(C.deep, smooth01(depth / 0.8)).lerp(C.lagoon, smooth01((depth - 0.6) / 2.2));
    return out;
  }
  const edge = grassEdge(theta) + (fbm(x * 0.22, z * 0.22) - 0.5) * 0.06;
  const grassT = smooth01((edge - q) / 0.03);
  // sand: a little wetter right at the waterline
  out.copy(C.sand).lerp(C.wet, 1 - smooth01(h / 0.18));
  if (grassT > 0) {
    const n = fbm(x * 0.09 + 11, z * 0.09 - 4);
    const n2 = fbm(x * 0.35 - 7, z * 0.35 + 2);
    const g = new THREE.Color().copy(C.grass).lerp(C.grass2, smooth01((n - 0.42) / 0.25)).lerp(C.grass3, smooth01((n2 - 0.62) / 0.2) * 0.7);
    out.lerp(g, grassT);
  }
  // the plaza: soft cream rings
  const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  if (dp < 6.2) {
    const ring = Math.floor(dp / 0.9) % 2 === 0 ? C.plaza : C.plaza2;
    out.lerp(ring, 1 - smooth01((dp - 5.6) / 0.6));
  } else {
    const pd = pathDistance(x, z);
    if (pd < 1.35) out.lerp(C.path, (1 - smooth01((pd - 0.85) / 0.5)) * grassT);
  }
  return out;
}

export function buildTerrain(segX = 192, segZ = 138) {
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    groundColor(x, z, h, col);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  // The deep seabed is never really visible under the water; cutting it lets the hero
  // diorama fade the sea out into the page instead of showing a rectangle of seabed.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('void main() {', 'void main() {\n  if (vWorldY < -2.4) discard;');
  };
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Heights encoded into a texture (R channel, −5..+5 m → 0..255) for the water shader. */
export function buildHeightTexture(w = 256, h = 184) {
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = BOUNDS.minX + ((i + 0.5) / w) * W;
      const z = BOUNDS.minZ + ((j + 0.5) / h) * D;
      const v = Math.round(THREE.MathUtils.clamp((terrainHeight(x, z) + 5) / 10, 0, 1) * 255);
      const k = (j * w + i) * 4;
      data[k] = v;
      data[k + 1] = v;
      data[k + 2] = v;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

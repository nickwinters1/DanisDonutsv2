/* Collectibles: 40 giant glowing sprinkles (one instanced draw call) and messages in bottles
 * that wash up in the shallows, each carrying a community note. */
import * as THREE from 'three';
import { BOTTLE_SPOTS, SPRINKLE_SPOTS, groundHeight, terrainHeight } from '../layout';
import { merge, softCircle, tint } from '../mats';

const COLORS = ['#ff8fc7', '#8fe3ff', '#ffe08a', '#b9a3ff', '#9ff0c8', '#ffb38a'];

/** Three crossed sprinkles: reads as "sprinkles" from any angle. */
function sprinkleStar() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.CapsuleGeometry(0.075, 0.36, 4, 10);
    g.rotateZ((k * Math.PI) / 3);
    g.rotateX(k * 0.35);
    tint(g, COLORS[k * 2]);
    parts.push(g);
  }
  const c = new THREE.SphereGeometry(0.07, 10, 8);
  tint(c, '#ffffff');
  parts.push(c);
  return merge(parts);
}

export class Sprinkles {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private halo: THREE.Points;
  private haloAlpha: Float32Array;
  private dummy = new THREE.Object3D();
  private base: THREE.Vector3[];
  private popping = new Map<number, number>();
  collected: Set<number>;

  constructor(collected: number[]) {
    this.collected = new Set(collected);
    this.base = SPRINKLE_SPOTS.map((p) => new THREE.Vector3(p.x, groundHeight(p.x, p.z) + 0.75, p.z));
    const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: new THREE.Color('#ffffff'), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 });
    this.mesh = new THREE.InstancedMesh(sprinkleStar(), m, this.base.length);
    this.mesh.castShadow = true;
    const hp = new Float32Array(this.base.length * 3);
    this.base.forEach((b, i) => hp.set([b.x, b.y, b.z], i * 3));
    this.haloAlpha = new Float32Array(this.base.length);
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hg.setAttribute('alpha', new THREE.BufferAttribute(this.haloAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.halo = new THREE.Points(
      hg,
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: softCircle() }, uScale: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float alpha; uniform float uScale; varying float vA;
          void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uScale * 340.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; varying float vA;
          void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.94, 0.98), t.a * vA * 0.75); }`,
      }),
    );
    this.halo.frustumCulled = false;
    this.group.add(this.mesh, this.halo);
  }

  setPointScale(s: number) {
    (this.halo.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
  }

  get total() {
    return this.base.length;
  }

  /** Returns the indices of sprinkles touched this frame. */
  check(p: THREE.Vector3) {
    const got: number[] = [];
    this.base.forEach((b, i) => {
      if (this.collected.has(i)) return;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      if (dx * dx + dz * dz < 0.95 * 0.95 && Math.abs(b.y - 0.75 - p.y) < 1.6) {
        this.collected.add(i);
        this.popping.set(i, 0);
        got.push(i);
      }
    });
    return got;
  }

  position(i: number) {
    return this.base[i];
  }

  update(dt: number, time: number) {
    this.base.forEach((b, i) => {
      let s = 1;
      let y = b.y + Math.sin(time * 2.2 + i) * 0.14;
      if (this.collected.has(i)) {
        const t = this.popping.get(i);
        if (t === undefined || t > 0.35) {
          s = 0;
        } else {
          this.popping.set(i, t + dt);
          s = 1 + t * 3;
          y += t * 3;
        }
      }
      this.dummy.position.set(b.x, y, b.z);
      this.dummy.rotation.set(0.25, time * 1.6 + i, 0);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.haloAlpha[i] = this.collected.has(i) ? 0 : 0.75 + Math.sin(time * 3 + i) * 0.25;
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.halo.geometry.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
  }
}

/* ───────── messages in bottles ───────── */

function bottleMesh() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhongMaterial({ color: '#bdf0e6', transparent: true, opacity: 0.7, shininess: 120, specular: new THREE.Color('#ffffff') });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 12), glass);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.2, 10), glass);
  neck.position.y = 0.33;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.1, 8), new THREE.MeshLambertMaterial({ color: '#c58f5e' }));
  cork.position.y = 0.46;
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), new THREE.MeshLambertMaterial({ color: '#fff3d6', emissive: new THREE.Color('#fff3d6'), emissiveIntensity: 0.3 }));
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 4, 12), new THREE.MeshLambertMaterial({ color: '#ff7aa2' }));
  ribbon.rotation.x = Math.PI / 2;
  g.add(paper, ribbon, body, neck, cork);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softCircle(), color: '#fff6c9', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
  glow.scale.setScalar(1.6);
  g.add(glow);
  return g;
}

export class Bottles {
  readonly group = new THREE.Group();
  private items: { g: THREE.Group; spot: number; respawn: number; ph: number }[] = [];

  constructor(count = 3) {
    const spots = [...BOTTLE_SPOTS.keys()].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, spots.length); i++) {
      const g = bottleMesh();
      this.group.add(g);
      this.items.push({ g, spot: spots[i], respawn: 0, ph: Math.random() * 10 });
    }
  }

  private freeSpot(except: number) {
    const used = new Set(this.items.map((i) => i.spot));
    const free = [...BOTTLE_SPOTS.keys()].filter((k) => !used.has(k) && k !== except);
    return free.length ? free[Math.floor(Math.random() * free.length)] : except;
  }

  /** Returns true when the player picked up a bottle this frame. */
  check(p: THREE.Vector3) {
    for (const it of this.items) {
      if (it.respawn > 0) continue;
      const s = BOTTLE_SPOTS[it.spot];
      if (Math.hypot(s.x - p.x, s.z - p.z) < 1.15) {
        it.respawn = 25;
        it.g.visible = false;
        return true;
      }
    }
    return false;
  }

  /** Where the nearest bottle is (for the guide's hints). */
  nearest(p: THREE.Vector3) {
    let best: THREE.Vector3 | null = null;
    let bd = Infinity;
    for (const it of this.items) {
      if (it.respawn > 0) continue;
      const s = BOTTLE_SPOTS[it.spot];
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < bd) {
        bd = d;
        best = new THREE.Vector3(s.x, 0, s.z);
      }
    }
    return best;
  }

  update(dt: number, time: number) {
    for (const it of this.items) {
      if (it.respawn > 0) {
        it.respawn -= dt;
        if (it.respawn <= 0) {
          it.spot = this.freeSpot(it.spot);
          it.g.visible = true;
        }
        continue;
      }
      const s = BOTTLE_SPOTS[it.spot];
      const floor = terrainHeight(s.x, s.z);
      it.g.position.set(s.x, Math.max(floor + 0.15, Math.sin(time * 1.6 + it.ph) * 0.06 + 0.02), s.z);
      it.g.rotation.set(1.2 + Math.sin(time * 1.3 + it.ph) * 0.15, it.ph, Math.sin(time * 1.1 + it.ph) * 0.2);
    }
  }
}

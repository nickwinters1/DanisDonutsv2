/* Pooled particles (sparkles, sand puffs, splashes, confetti), fireworks and sky lanterns. */
import * as THREE from 'three';
import { softCircle } from '../mats';

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
  grav: number;
  drag: number;
  fade: number;
  twinkle: number;
}

export interface EmitOpts {
  count: number;
  pos: THREE.Vector3;
  color: string | string[];
  speed?: number;
  spread?: number;
  up?: number;
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  twinkle?: number;
  /** 'sphere' bursts in all directions; 'ring' spreads flat; 'cone' shoots up */
  shape?: 'sphere' | 'ring' | 'cone';
}

export class Particles {
  readonly points: THREE.Points;
  private pool: P[] = [];
  private alive: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private geo = new THREE.BufferGeometry();
  readonly uniforms = { uMap: { value: softCircle() }, uScale: { value: 1 } };
  private tmp = new THREE.Color();

  constructor(
    private max: number,
    additive: boolean,
  ) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float psize; attribute float alpha; uniform float uScale;
        varying vec3 vC; varying float vA;
        void main(){
          vC = color; vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uScale * psize * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(this.geo, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(o: EmitOpts) {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    for (let i = 0; i < o.count; i++) {
      if (this.alive.length >= this.max) return;
      const p = this.pool.pop() ?? ({} as P);
      const sp = (o.speed ?? 3) * (0.55 + Math.random() * 0.45);
      let dx: number;
      let dy: number;
      let dz: number;
      if (o.shape === 'ring') {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a);
        dz = Math.sin(a);
        dy = 0.3 + Math.random() * 0.4;
      } else if (o.shape === 'cone') {
        const a = Math.random() * Math.PI * 2;
        const s = (o.spread ?? 0.35) * Math.random();
        dx = Math.cos(a) * s;
        dz = Math.sin(a) * s;
        dy = 1;
      } else {
        // uniform on a sphere
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        dx = Math.cos(a) * r;
        dy = u;
        dz = Math.sin(a) * r;
      }
      p.x = o.pos.x;
      p.y = o.pos.y;
      p.z = o.pos.z;
      p.vx = dx * sp;
      p.vy = dy * sp + (o.up ?? 0);
      p.vz = dz * sp;
      p.max = p.life = (o.life ?? 1) * (0.7 + Math.random() * 0.5);
      p.size = (o.size ?? 0.25) * (0.7 + Math.random() * 0.6);
      this.tmp.set(colors[Math.floor(Math.random() * colors.length)]);
      p.r = this.tmp.r;
      p.g = this.tmp.g;
      p.b = this.tmp.b;
      p.grav = o.gravity ?? 6;
      p.drag = o.drag ?? 1.5;
      p.fade = 1;
      p.twinkle = o.twinkle ?? 0;
      this.alive.push(p);
    }
  }

  update(dt: number, time: number) {
    let n = 0;
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.alive.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vz *= d;
      p.vy = p.vy * d - p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (const p of this.alive) {
      const t = p.life / p.max;
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.r;
      this.col[n * 3 + 1] = p.g;
      this.col[n * 3 + 2] = p.b;
      this.size[n] = p.size * (0.6 + 0.4 * t);
      const tw = p.twinkle ? 0.6 + 0.4 * Math.sin(time * 30 * p.twinkle + n) : 1;
      this.alpha[n] = Math.min(1, t * 2.2) * tw;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const name of ['position', 'color', 'psize', 'alpha']) (this.geo.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
  }

  get count() {
    return this.alive.length;
  }
}

const FIREWORK_COLORS = [
  ['#ff9ad5', '#ffd1ec', '#ffffff'],
  ['#9fe6ff', '#d6f6ff', '#ffffff'],
  ['#ffe08a', '#fff4c9', '#ffb3cc'],
  ['#c9b8ff', '#efe7ff', '#ff9ad5'],
  ['#a9f0cf', '#e4fff3', '#ffe08a'],
];

/** Rockets that rise from the sea and burst in pastel colours. */
export class Fireworks {
  private rockets: { pos: THREE.Vector3; vy: number; fuse: number; colors: string[] }[] = [];
  private timer = 0;
  active = 0;

  constructor(
    private glow: Particles,
    private onBurst: (pos: THREE.Vector3) => void,
    private onLaunch: () => void,
  ) {}

  /** keep launching for `seconds` */
  start(seconds: number) {
    this.active = Math.max(this.active, seconds);
    this.timer = 0;
  }

  launch(at?: THREE.Vector3) {
    const pos = at?.clone() ?? new THREE.Vector3((Math.random() - 0.5) * 70, 0, -38 - Math.random() * 30);
    this.rockets.push({ pos, vy: 24 + Math.random() * 6, fuse: 1 + Math.random() * 0.5, colors: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)] });
    this.onLaunch();
  }

  update(dt: number) {
    if (this.active > 0) {
      this.active -= dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.35 + Math.random() * 0.7;
        this.launch();
        if (Math.random() < 0.3) this.launch();
      }
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.fuse -= dt;
      r.vy -= 9 * dt;
      r.pos.y += r.vy * dt;
      this.glow.emit({ count: 2, pos: r.pos, color: '#fff2d6', speed: 0.4, size: 2.2, life: 0.45, gravity: 2 });
      if (r.fuse <= 0) {
        this.glow.emit({ count: 120, pos: r.pos, color: r.colors, speed: 15, size: 5.5, life: 2.3, gravity: 3.5, drag: 1.3, twinkle: 0.5 });
        this.glow.emit({ count: 30, pos: r.pos, color: '#ffffff', speed: 5, size: 4, life: 1.1, gravity: 2, drag: 2 });
        this.onBurst(r.pos.clone());
        this.rockets.splice(i, 1);
      }
    }
  }
}

/** Glowing paper lanterns that drift up into the night sky — one for each person who wrote in. */
export class SkyLanterns {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private glow: THREE.Points;
  private data: { x: number; z: number; y: number; vy: number; ph: number; delay: number }[] = [];
  private glowPos: Float32Array;
  private dummy = new THREE.Object3D();
  private running = false;

  constructor(private max = 90) {
    const geo = new THREE.CylinderGeometry(0.28, 0.2, 0.55, 8, 1, true);
    const top = new THREE.CircleGeometry(0.28, 8);
    void top;
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: '#ffd7a0', side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
      max,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.glowPos = new Float32Array(max * 3);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(this.glowPos, 3).setUsage(THREE.DynamicDrawUsage));
    gg.setDrawRange(0, 0);
    this.glow = new THREE.Points(
      gg,
      new THREE.PointsMaterial({ map: softCircle(), color: '#ffb36b', size: 2.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }),
    );
    this.glow.frustumCulled = false;
    this.group.add(this.mesh, this.glow);
  }

  release(count: number) {
    const n = Math.min(this.max, Math.max(12, count));
    this.data = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 26;
      this.data.push({ x: Math.cos(a) * r * 1.2, z: Math.sin(a) * r * 0.8, y: 1.5, vy: 1.2 + Math.random() * 1.1, ph: Math.random() * 10, delay: Math.random() * 6 });
    }
    this.mesh.count = n;
    this.glow.geometry.setDrawRange(0, n);
    this.running = true;
  }

  stop() {
    this.running = false;
    this.mesh.count = 0;
    this.glow.geometry.setDrawRange(0, 0);
  }

  update(dt: number, time: number) {
    if (!this.running) return;
    this.data.forEach((d, i) => {
      if (d.delay > 0) d.delay -= dt;
      else d.y += d.vy * dt;
      if (d.y > 70) {
        d.y = 1.5;
        d.delay = Math.random() * 3;
      }
      const x = d.x + Math.sin(time * 0.4 + d.ph) * 1.5 + d.y * 0.15;
      const z = d.z + Math.cos(time * 0.3 + d.ph) * 1.2;
      this.dummy.position.set(x, d.delay > 0 ? -50 : d.y, z);
      this.dummy.rotation.set(Math.sin(time + d.ph) * 0.1, 0, Math.cos(time * 0.8 + d.ph) * 0.1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.glowPos.set([x, d.delay > 0 ? -50 : d.y, z], i * 3);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.glow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

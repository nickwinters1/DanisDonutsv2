/* Sky dome, stars, clouds, lights and fog — all driven by one "time of day".
 * The island starts in a soft morning and drifts toward golden hour and sunset as quests
 * are completed; the grand finale turns it into a starry night. */
import * as THREE from 'three';
import { softCircle } from '../mats';

interface Preset {
  zenith: string;
  horizon: string;
  band: string;
  bandAmt: number;
  sun: string;
  sunI: number;
  elev: number; // degrees
  az: number; // degrees, 0 = north (−z), 90 = east
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  shallow: string;
  deep: string;
  cloud: string;
  night: number;
}

const P = (p: Preset) => p;
/** Ordered by quest progress (0 → 6 quests). */
const DAY: Preset[] = [
  P({ zenith: '#86c3f0', horizon: '#fde8e2', band: '#ffd6e6', bandAmt: 0.25, sun: '#fff3dc', sunI: 2.5, elev: 34, az: 120, hemiSky: '#d6ecff', hemiGround: '#f6dcc3', hemiI: 1.55, shallow: '#9fe9df', deep: '#4fb0d1', cloud: '#ffffff', night: 0 }),
  P({ zenith: '#77bdf1', horizon: '#e9f6ff', band: '#fff1f6', bandAmt: 0.12, sun: '#fffaf0', sunI: 2.75, elev: 58, az: 150, hemiSky: '#dff1ff', hemiGround: '#f6e2c8', hemiI: 1.6, shallow: '#9debe0', deep: '#45abd2', cloud: '#ffffff', night: 0 }),
  P({ zenith: '#80b2ee', horizon: '#fff1dc', band: '#ffe3c8', bandAmt: 0.25, sun: '#fff0d2', sunI: 2.6, elev: 42, az: 200, hemiSky: '#e3ecff', hemiGround: '#f8dcc0', hemiI: 1.55, shallow: '#a3e8dc', deep: '#4ea7cf', cloud: '#fff8f0', night: 0 }),
  P({ zenith: '#8f9ae2', horizon: '#ffdcb6', band: '#ffc3a3', bandAmt: 0.45, sun: '#ffd9a8', sunI: 2.35, elev: 22, az: 228, hemiSky: '#e8dcff', hemiGround: '#f9cfb0', hemiI: 1.45, shallow: '#acdfd8', deep: '#5a9fcf', cloud: '#ffe9df', night: 0 }),
  P({ zenith: '#8a79cf', horizon: '#ffbf9d', band: '#f79ac0', bandAmt: 0.7, sun: '#ffb98f', sunI: 2.1, elev: 11, az: 245, hemiSky: '#e7cdf5', hemiGround: '#f6bca5', hemiI: 1.35, shallow: '#b5d6d8', deep: '#6a8fcc', cloud: '#ffd5d8', night: 0 }),
];
const NIGHT: Preset = {
  zenith: '#151240',
  horizon: '#4b3a7e',
  band: '#9c6fb8',
  bandAmt: 0.35,
  sun: '#c9d2ff',
  sunI: 0.85,
  elev: 48,
  az: 160,
  hemiSky: '#5c5aa6',
  hemiGround: '#3c2f5a',
  hemiI: 0.9,
  shallow: '#5d8fb0',
  deep: '#263f7a',
  cloud: '#a59ad6',
  night: 1,
};

const col = (h: string) => new THREE.Color(h);

export class Sky {
  readonly group = new THREE.Group();
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly fog = new THREE.Fog('#fde8e2', 80, 300);
  readonly sunDir = new THREE.Vector3();
  readonly uniforms = {
    uZenith: { value: col(DAY[0].zenith) },
    uHorizon: { value: col(DAY[0].horizon) },
    uBand: { value: col(DAY[0].band) },
    uBandAmt: { value: 0.25 },
    uSunColor: { value: col(DAY[0].sun) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };
  /** Water tints, shared with the water shader. */
  readonly water = { uShallow: { value: col(DAY[0].shallow) }, uDeep: { value: col(DAY[0].deep) } };
  private dome: THREE.Mesh;
  private stars: THREE.Points;
  private clouds: THREE.Group;
  private cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.35 });
  private current = 0;
  private target = 0;
  private nightNow = 0;
  private nightTarget = 0;

  constructor() {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(480, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uZenith, uHorizon, uBand, uSunColor, uSunDir;
          uniform float uBandAmt, uNight;
          varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.62, max(h, 0.0)), 0.75));
            c = mix(c, uBand, uBandAmt * exp(-abs(h - 0.06) * 9.0));
            if (h < 0.0) c = uHorizon;
            float s = max(dot(d, uSunDir), 0.0);
            c += uSunColor * (pow(s, 10.0) * 0.22 + pow(s, 120.0) * 0.5) * (1.0 - uNight * 0.7);
            float disk = smoothstep(0.99925, 0.99955, s);
            c = mix(c, uSunColor * 1.25 + vec3(0.12), disk * (1.0 - step(h, 0.0)));
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    /* Stars */
    const n = 900;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const y = 0.06 + Math.pow(Math.random(), 0.8) * 0.94;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(u) * r * 420, y * 420, Math.sin(u) * r * 420], i * 3);
      seed[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: { uNight: this.uniforms.uNight, uTime: this.uniforms.uTime, uMap: { value: softCircle() } },
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float seed; uniform float uTime; uniform float uNight; varying float vA;
          void main(){
            vA = uNight * (0.55 + 0.45 * sin(uTime * (0.7 + seed * 2.5) + seed * 60.0)) * smoothstep(0.05, 0.3, normalize(position).y);
            gl_PointSize = 1.6 + seed * seed * 3.4;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; varying float vA;
          void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.96, 1.0), t.a * vA); }`,
      }),
    );
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.group.add(this.stars);

    /* Clouds: puffy low-poly groups drifting around the island */
    this.clouds = new THREE.Group();
    const puff = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 11; i++) {
      const cloud = new THREE.Group();
      const parts = 4 + (i % 3);
      for (let k = 0; k < parts; k++) {
        const m = new THREE.Mesh(puff, this.cloudMat);
        const s = 2.4 + Math.random() * 2.6;
        m.scale.set(s * 1.25, s * 0.8, s);
        m.position.set((k - parts / 2) * 2.6 + Math.random(), Math.random() * 1.2, Math.random() * 2 - 1);
        cloud.add(m);
      }
      const near = i < 5;
      const a = (i / 11) * Math.PI * 2 + Math.random() * 0.3;
      const r = near ? 62 + Math.random() * 14 : 120 + Math.random() * 60;
      cloud.position.set(Math.cos(a) * r, near ? 15 + Math.random() * 6 : 26 + Math.random() * 18, Math.sin(a) * r);
      cloud.userData = { a, r, speed: 0.004 + Math.random() * 0.004 };
      cloud.scale.setScalar(near ? 0.8 : 1.6);
      this.clouds.add(cloud);
    }
    this.group.add(this.clouds);

    this.hemi = new THREE.HemisphereLight(DAY[0].hemiSky, DAY[0].hemiGround, DAY[0].hemiI);
    this.sun = new THREE.DirectionalLight(DAY[0].sun, DAY[0].sunI);
    this.apply(0, 0);
  }

  /** progress: 0..1 across the day (quests done / 6). night: 0..1 (finale). */
  setTarget(progress: number, night: number, instant = false) {
    this.target = progress;
    this.nightTarget = night;
    if (instant) {
      this.current = progress;
      this.nightNow = night;
      this.apply(progress, night);
    }
  }

  get isNight() {
    return this.nightNow > 0.5;
  }
  get nightAmount() {
    return this.nightNow;
  }

  update(dt: number, time: number, camera: THREE.Camera) {
    this.uniforms.uTime.value = time;
    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    const k = 1 - Math.exp(-dt * 0.9);
    if (Math.abs(this.current - this.target) > 0.0005 || Math.abs(this.nightNow - this.nightTarget) > 0.0005) {
      this.current += (this.target - this.current) * k;
      this.nightNow += (this.nightTarget - this.nightNow) * k;
      this.apply(this.current, this.nightNow);
    }
    for (const c of this.clouds.children) {
      const u = c.userData as { a: number; r: number; speed: number };
      u.a += u.speed * dt;
      c.position.x = Math.cos(u.a) * u.r;
      c.position.z = Math.sin(u.a) * u.r;
    }
  }

  private apply(progress: number, night: number) {
    const f = Math.min(DAY.length - 1.0001, Math.max(0, progress) * (DAY.length - 1));
    const i = Math.floor(f);
    const t = f - i;
    const a = DAY[i];
    const b = DAY[i + 1];
    const mix = (k: keyof Preset) => col(a[k] as string).lerp(col(b[k] as string), t).lerp(col(NIGHT[k] as string), night);
    const num = (k: keyof Preset) => {
      const v = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
      return v + ((NIGHT[k] as number) - v) * night;
    };
    this.uniforms.uZenith.value.copy(mix('zenith'));
    this.uniforms.uHorizon.value.copy(mix('horizon'));
    this.uniforms.uBand.value.copy(mix('band'));
    this.uniforms.uBandAmt.value = num('bandAmt');
    this.uniforms.uSunColor.value.copy(mix('sun'));
    this.uniforms.uNight.value = night;
    this.water.uShallow.value.copy(mix('shallow'));
    this.water.uDeep.value.copy(mix('deep'));
    const elev = THREE.MathUtils.degToRad(num('elev'));
    const az = THREE.MathUtils.degToRad(num('az'));
    this.sunDir.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)).normalize();
    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.sun.color.copy(mix('sun'));
    this.sun.intensity = num('sunI');
    this.hemi.color.copy(mix('hemiSky'));
    this.hemi.groundColor.copy(mix('hemiGround'));
    this.hemi.intensity = num('hemiI');
    this.fog.color.copy(mix('horizon'));
    this.cloudMat.color.copy(mix('cloud'));
    this.cloudMat.emissive.copy(mix('cloud')).multiplyScalar(0.35);
  }

  /** Clouds only make sense with a sky behind them (play mode); the hero diorama hides them. */
  setClouds(visible: boolean) {
    this.clouds.visible = visible;
  }

  setVisible(sky: boolean) {
    this.dome.visible = sky;
    this.stars.visible = sky;
  }
}

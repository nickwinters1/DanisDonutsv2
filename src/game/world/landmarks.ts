/* The six destinations, the plaza (fountain, quest lanterns, the grand-finale gift), the dock,
 * the world globe, the stepping stones and the secret golden donut. */
import * as THREE from 'three';
import { PAL, blobShadow, gloss, mat, merge, mesh, place, rbox, signTexture, softCircle, tint } from '../mats';
import { cachedDonut, donutMesh, sprinkleMat } from '../actors/donutGeo';
import { DOCK, GLOBE, GOLDEN, LANDMARKS, LANTERNS, PLAZA, STONES, groundHeight, rng, terrainHeight, type Landmark } from '../layout';
import { ZONES } from '../../data/catalog';
import type { Category } from '../../data/types';

export interface Anchor {
  id: string;
  kind: 'zone' | 'globe' | 'finale' | 'golden';
  zone?: Category;
  pos: THREE.Vector3;
  /** label height above pos */
  labelY: number;
}

function glowSprite(color: string, scale: number, opacity = 0.8) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: softCircle(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }),
  );
  s.scale.setScalar(scale);
  return s;
}

function signBoard(text: string, w: number, h: number, colors: { bg: string; fg: string; border?: string }) {
  const tex = signTexture(text, { bg: colors.bg, fg: colors.fg, border: colors.border, w: Math.round(512 * (w / h) * 0.32), h: 160 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
  return m;
}

/* ───────── canvases (arcade screens, polaroid board, postcards, globe, cards) ───────── */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function polaroidBoard() {
  const { c, g } = canvas(512, 320);
  g.fillStyle = '#e8c79f';
  g.beginPath();
  g.roundRect(0, 0, 512, 320, 28);
  g.fill();
  g.fillStyle = '#dcb88c';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 512, Math.random() * 320, 3, 3);
  g.fillStyle = '#8a5a3c';
  g.font = '700 40px "Fredoka Variable", system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('MEMORY BEACH', 256, 52);
  const scenes = [
    ['#ffd9c2', '#9fd8ea', '#ffcf6b'],
    ['#e9e0ff', '#f7b6cf', '#fff2a8'],
    ['#d7f3e8', '#8fd0c7', '#ffffff'],
    ['#fff0d6', '#f5a3bd', '#c8b5ff'],
  ];
  scenes.forEach((s, i) => {
    const x = 34 + i * 118;
    const y = 82 + (i % 2) * 18;
    g.save();
    g.translate(x + 50, y + 100);
    g.rotate((i - 1.5) * 0.06);
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.fillRect(-48, -96, 100, 124);
    g.fillStyle = '#fffdf8';
    g.fillRect(-50, -100, 100, 124);
    g.fillStyle = s[0];
    g.fillRect(-42, -92, 84, 84);
    g.fillStyle = s[1];
    g.fillRect(-42, -40, 84, 32);
    g.fillStyle = s[2];
    g.beginPath();
    g.arc(14 - i * 6, -66, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff7aa2';
    g.beginPath();
    g.arc(0, -104, 7, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function postcard(seed: number) {
  const { c, g } = canvas(128, 88);
  const r = rng(seed);
  g.fillStyle = '#fffaf2';
  g.fillRect(0, 0, 128, 88);
  const sky = g.createLinearGradient(0, 6, 0, 60);
  sky.addColorStop(0, ['#ffc9d9', '#c9e9ff', '#ffe0b5'][seed % 3]);
  sky.addColorStop(1, '#fff3e0');
  g.fillStyle = sky;
  g.fillRect(6, 6, 116, 54);
  g.fillStyle = '#8fd0dc';
  g.fillRect(6, 44, 116, 16);
  g.fillStyle = '#ffcf6b';
  g.beginPath();
  g.arc(30 + r() * 60, 30, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c28f6a';
  g.font = '600 13px system-ui';
  g.fillText('wish you were here ♡', 8, 78);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function globeTexture() {
  const { c, g } = canvas(512, 256);
  g.fillStyle = '#9fd8ea';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    g.beginPath();
    g.moveTo(0, i * 42);
    g.lineTo(512, i * 42);
    g.stroke();
  }
  const land = (pts: [number, number, number, number][], color: string) => {
    g.fillStyle = color;
    for (const [x, y, rx, ry] of pts) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  land([[95, 80, 48, 34], [120, 112, 26, 22], [70, 62, 30, 18]], '#a9dcb0'); // N. America
  land([[150, 170, 20, 34], [140, 150, 18, 18]], '#ffc2d4'); // S. America
  land([[258, 72, 24, 18], [272, 92, 16, 12]], '#c9b8ff'); // Europe
  land([[268, 140, 30, 42]], '#ffe2a0'); // Africa
  land([[350, 78, 60, 34], [390, 104, 34, 22]], '#a9dcb0'); // Asia
  land([[430, 182, 28, 18]], '#ffc2d4'); // Oceania
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cardTexture(kind: 'star' | 'heart' | 'gem', a: string, b: string) {
  const { c, g } = canvas(256, 356);
  const grd = g.createLinearGradient(0, 0, 256, 356);
  grd.addColorStop(0, a);
  grd.addColorStop(1, b);
  g.fillStyle = '#f7d37a';
  g.beginPath();
  g.roundRect(0, 0, 256, 356, 22);
  g.fill();
  g.fillStyle = grd;
  g.beginPath();
  g.roundRect(12, 12, 232, 332, 14);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.beginPath();
  g.roundRect(28, 40, 200, 170, 12);
  g.fill();
  g.fillStyle = '#ffffff';
  g.save();
  g.translate(128, 125);
  if (kind === 'star') {
    g.fillStyle = '#ffcf5c';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? 26 : 62;
      g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    g.fill();
  } else if (kind === 'heart') {
    g.fillStyle = '#ff7aa2';
    g.beginPath();
    g.moveTo(0, 50);
    g.bezierCurveTo(-90, -10, -40, -80, 0, -30);
    g.bezierCurveTo(40, -80, 90, -10, 0, 50);
    g.fill();
  } else {
    g.fillStyle = '#a58cf0';
    g.beginPath();
    g.moveTo(0, -62);
    g.lineTo(52, -16);
    g.lineTo(0, 62);
    g.lineTo(-52, -16);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.moveTo(0, -62);
    g.lineTo(14, -16);
    g.lineTo(0, 62);
    g.lineTo(-14, -16);
    g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.beginPath();
  g.roundRect(28, 228, 200, 26, 8);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.roundRect(28, 266 + i * 18, 200 - i * 40, 10, 5);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const holoUniforms = { uTime: { value: 0 } };
function holoMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: holoUniforms.uTime },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        float ang = abs(dot(vN, vV));
        vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vUv.x * 0.7 + vUv.y * 0.5 + uTime * 0.12 + ang * 1.6) + vec3(0.0, 2.1, 4.2));
        float sweep = smoothstep(0.14, 0.0, abs(fract(vUv.x * 0.8 + vUv.y * 0.4 - uTime * 0.22) - 0.5));
        vec3 c = t.rgb * 1.05 + rainbow * 0.2 + sweep * 0.35;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

class ArcadeScreen {
  readonly tex: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private c: HTMLCanvasElement;
  constructor(readonly title: string, readonly hue: string) {
    const { c, g } = canvas(160, 120);
    this.c = c;
    this.g = g;
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.magFilter = THREE.NearestFilter;
    this.draw(0);
  }
  draw(t: number) {
    const g = this.g;
    const grd = g.createLinearGradient(0, 0, 0, 120);
    grd.addColorStop(0, '#24164f');
    grd.addColorStop(1, this.hue);
    g.fillStyle = grd;
    g.fillRect(0, 0, 160, 120);
    for (let i = 0; i < 18; i++) {
      const x = (i * 37 + t * 12 * (1 + (i % 3))) % 160;
      g.fillStyle = i % 4 ? 'rgba(255,255,255,.5)' : '#ffd6f0';
      g.fillRect(x, (i * 23) % 70, 2, 2);
    }
    // falling donuts
    for (let k = 0; k < 3; k++) {
      const x = 30 + k * 50;
      const y = ((t * 40 + k * 37) % 80) + 22;
      g.fillStyle = '#e2ad72';
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ['#ff8fc7', '#9fe6e0', '#c9b8ff'][k];
      g.beginPath();
      g.arc(x, y - 1, 7.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#24164f';
      g.beginPath();
      g.arc(x, y - 1, 3, 0, Math.PI * 2);
      g.fill();
    }
    // catcher
    const cx = 80 + Math.sin(t * 2.2) * 50;
    g.fillStyle = '#ffe08a';
    g.fillRect(cx - 14, 104, 28, 6);
    g.fillStyle = '#fff';
    g.font = 'bold 13px monospace';
    g.textAlign = 'center';
    g.fillText(this.title, 80, 16);
    if (Math.floor(t * 2) % 2 === 0) {
      g.fillStyle = '#ffe08a';
      g.font = 'bold 10px monospace';
      g.fillText('PRESS START', 80, 98);
    }
    this.tex.needsUpdate = true;
    void this.c;
  }
}

/* ───────── each destination ───────── */

function donutShop(): { g: THREE.Group; donut: THREE.Group; lights: THREE.Mesh[] } {
  const g = new THREE.Group();
  const cream = mat(PAL.cream);
  g.add(mesh(rbox(7.6, 0.3, 6, 0.1), mat('#f0d9bd')).translateY(0.12).translateZ(0.2));
  const house = mesh(rbox(6.4, 3, 4, 0.18), cream);
  house.position.set(0, 1.7, -0.9);
  const trim = mesh(rbox(6.5, 0.55, 4.1, 0.14), mat(PAL.pink));
  trim.position.set(0, 0.5, -0.9);
  const roof = mesh(rbox(6.9, 0.55, 4.5, 0.25), gloss('#f7b3c8', 60, 0.3));
  roof.position.set(0, 3.38, -0.9);
  g.add(house, trim, roof);
  // frosting drips along the roof edge
  const r = rng(5);
  for (let i = 0; i < 13; i++) {
    const len = 0.25 + r() * 0.55;
    const d = mesh(new THREE.CapsuleGeometry(0.13, len, 3, 8), gloss('#f7b3c8', 60, 0.3), 'cast');
    d.position.set(-3.1 + i * 0.52, 3.12 - len / 2, 1.32);
    g.add(d);
  }
  // striped awning
  for (let i = 0; i < 7; i++) {
    const s = mesh(new THREE.BoxGeometry(0.9, 0.07, 1.5), mat(i % 2 ? '#ffffff' : PAL.pinkDeep));
    s.position.set(-2.7 + i * 0.9, 2.55, 1.75);
    s.rotation.x = 0.38;
    g.add(s);
    // a scalloped edge hanging under the awning's front lip
    const sc = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.07, 12, 1, false, -Math.PI / 2, Math.PI), mat(i % 2 ? '#ffffff' : PAL.pinkDeep));
    sc.rotation.x = Math.PI / 2;
    sc.position.set(-2.7 + i * 0.9, 2.27, 2.45);
    g.add(sc);
  }
  // door + windows
  const door = mesh(rbox(1.15, 1.9, 0.18, 0.08), mat(PAL.berry));
  door.position.set(0, 1.15, 1.12);
  const knob = mesh(new THREE.SphereGeometry(0.07, 8, 6), gloss(PAL.gold, 90, 0.6));
  knob.position.set(0.38, 1.1, 1.24);
  g.add(door, knob);
  for (const x of [-2.05, 2.05]) {
    const frame = mesh(rbox(1.5, 1.15, 0.16, 0.06), mat('#ffffff'));
    frame.position.set(x, 1.75, 1.12);
    const glass = mesh(rbox(1.25, 0.9, 0.1, 0.05), mat('#bfe7ea', { emissive: '#bfe7ea', emissiveIntensity: 0.15 }));
    glass.position.set(x, 1.75, 1.18);
    g.add(frame, glass);
    // a little donut display in each window
    for (let k = 0; k < 3; k++) {
      const dn = donutMesh(cachedDonut('mini', 0.13, 0.06, 'rainbow', 3 + k, 0.5), mat(PAL.dough), gloss(['#f6a4c0', '#c9b8ff', '#9fe6e0'][k], 70, 0.3), sprinkleMat);
      dn.position.set(x - 0.38 + k * 0.38, 1.45, 1.26);
      g.add(dn);
    }
  }
  // sign + the giant donut on the roof
  const sign = signBoard('DONUTS', 3.2, 0.95, { bg: '#fff6ea', fg: '#b0507a', border: '#f4a7c0' });
  sign.position.set(0, 4.2, -0.1);
  const signBack = mesh(rbox(3.35, 1.05, 0.14, 0.08), mat(PAL.creamDark));
  signBack.position.set(0, 4.2, -0.2);
  g.add(signBack, sign);
  const pole = mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8), mat(PAL.woodDark));
  pole.position.set(0, 4.9, -0.9);
  g.add(pole);
  const big = donutMesh(cachedDonut('shop', 1.0, 0.48, 'rainbow', 42, 1.2), mat(PAL.dough), gloss('#f39db9', 80, 0.45), sprinkleMat);
  big.position.set(0, 6.25, -0.9);
  g.add(big);
  // café tables
  for (const x of [-3.6, 3.6]) {
    const t = new THREE.Group();
    t.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), mat('#ffffff')).translateY(0.85));
    t.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.85, 8), mat(PAL.woodDark)).translateY(0.42));
    t.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6), mat('#ffffff')).translateY(1.1));
    const umb = mesh(new THREE.ConeGeometry(1.15, 0.55, 10), mat(x < 0 ? PAL.mint : PAL.butter));
    umb.position.y = 2.25;
    t.add(umb);
    for (const sx of [-0.75, 0.75]) t.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 12), mat(PAL.pink)).translateX(sx).translateY(0.25));
    t.position.set(x, 0, 2.3);
    g.add(t);
  }
  // string lights under the awning (glow at night)
  const lights: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: ['#fff3c4', '#ffd1e3', '#d6f5ff'][i % 3] }));
    b.position.set(-3.2 + i * 0.8, 2.2 - Math.sin((i / 8) * Math.PI) * 0.18, 2.55);
    lights.push(b);
    g.add(b);
  }
  return { g, donut: big, lights };
}

function crystalCove(): { g: THREE.Group; glows: THREE.Sprite[]; mats: THREE.MeshPhongMaterial[] } {
  const g = new THREE.Group();
  const r = rng(12);
  // rocks around the back
  const rockGeos: THREE.BufferGeometry[] = [];
  const rockSpots = [
    [-2.6, -0.2, 1.1],
    [2.7, -0.4, 1.25],
    [-1.4, -2.4, 1.3],
    [1.5, -2.4, 1.35],
    [0, -3.4, 1.0],
    [-3.6, -1.8, 0.8],
    [3.6, -2, 0.85],
  ];
  for (const [x, z, s] of rockSpots) {
    const geo = new THREE.IcosahedronGeometry(s, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.8 + ((Math.sin(pos.getX(i) * 12.9 + pos.getY(i) * 7.1 + pos.getZ(i) * 3.3) + 1) / 2) * 0.35;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 1.15, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    tint(geo, r() > 0.5 ? PAL.rock : PAL.rock2);
    place(geo, x, s * 0.75, z, 0, r() * 3, 0);
    rockGeos.push(geo);
  }
  const rocks = new THREE.Mesh(merge(rockGeos), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  rocks.castShadow = rocks.receiveShadow = true;
  g.add(rocks);
  // the crystal cluster
  const colors = ['#b79cf0', '#f5a8c8', '#8fe0e0', '#f6d27a', '#95d9ae', '#c9b8ff', '#ffb8d9'];
  const glows: THREE.Sprite[] = [];
  const mats: THREE.MeshPhongMaterial[] = [];
  const crystals = [
    [0, -0.8, 0.42, 2.6, 0, 0],
    [-0.75, -0.6, 0.3, 1.8, 0.1, 0.35],
    [0.8, -0.7, 0.32, 1.9, -0.1, -0.38],
    [-0.35, -1.5, 0.28, 1.6, -0.3, 0.2],
    [0.45, -1.55, 0.26, 1.5, -0.3, -0.25],
    [-1.4, -0.9, 0.22, 1.1, 0.1, 0.6],
    [1.45, -1.0, 0.22, 1.2, 0.05, -0.62],
    [0.2, 0.15, 0.16, 0.8, 0.35, -0.2],
    [-0.4, 0.2, 0.14, 0.6, 0.4, 0.4],
  ];
  crystals.forEach(([x, z, rad, h, tx, tz], i) => {
    const color = colors[i % colors.length];
    const m = new THREE.MeshPhongMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.28,
      shininess: 120,
      specular: new THREE.Color('#ffffff'),
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });
    mats.push(m);
    const body = new THREE.CylinderGeometry(rad, rad * 1.1, h, 6);
    body.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(rad, rad * 1.8, 6);
    tip.translate(0, h + rad * 0.9, 0);
    const c = new THREE.Mesh(merge([tint(body, '#ffffff'), tint(tip, '#ffffff')]), m);
    c.position.set(x, 0, z);
    c.rotation.set(tx, r() * 1, tz);
    c.castShadow = true;
    g.add(c);
    const glow = glowSprite(color, 1.2 + h * 0.6, 0.55);
    const top = new THREE.Vector3(0, h * 0.75, 0).applyEuler(c.rotation).add(c.position);
    glow.position.copy(top);
    glows.push(glow);
    g.add(glow);
  });
  const post = mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.6, 6), mat(PAL.woodDark));
  post.position.set(2.3, 0.8, 1.7);
  const sign = signBoard('CRYSTAL COVE', 2.2, 0.55, { bg: '#f6f0ff', fg: '#7a5cc4', border: '#c9b8ff' });
  sign.position.set(2.3, 1.55, 1.78);
  g.add(post, sign);
  return { g, glows, mats };
}

function arcade(): { g: THREE.Group; screens: ArcadeScreen[]; neon: THREE.MeshBasicMaterial[] } {
  const g = new THREE.Group();
  g.add(mesh(rbox(6.6, 0.25, 5.2, 0.08), mat('#e6dcf7')).translateY(0.1).translateZ(0.2));
  const hall = mesh(rbox(5.8, 3.3, 3.8, 0.2), mat(PAL.lav));
  hall.position.set(0, 1.75, -0.7);
  const roof = mesh(rbox(6.2, 0.4, 4.2, 0.18), mat('#9d86de'));
  roof.position.set(0, 3.55, -0.7);
  g.add(hall, roof);
  const neonPink = new THREE.MeshBasicMaterial({ color: '#ff8fd0' });
  const neonCyan = new THREE.MeshBasicMaterial({ color: '#8ff0ff' });
  const neonGold = new THREE.MeshBasicMaterial({ color: '#ffe08a' });
  const strip = (w: number, x: number, y: number, z: number, m: THREE.Material, vertical = false) => {
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, w, 2, 6), m);
    if (!vertical) s.rotation.z = Math.PI / 2;
    s.position.set(x, y, z);
    g.add(s);
  };
  strip(5.6, 0, 3.32, 1.22, neonPink);
  strip(5.6, 0, 0.42, 1.22, neonCyan);
  strip(2.7, -2.86, 1.85, 1.22, neonPink, true);
  strip(2.7, 2.86, 1.85, 1.22, neonPink, true);
  // doorway
  const door = mesh(rbox(1.5, 2.2, 0.2, 0.1), mat('#3c2b6b'));
  door.position.set(0, 1.25, 1.12);
  g.add(door);
  strip(1.5, 0, 2.42, 1.25, neonGold);
  // sign + star
  const sign = signBoard('ARCADE', 3.4, 1.0, { bg: '#2c1d59', fg: '#ff9ad5', border: '#8ff0ff' });
  sign.position.set(0, 4.35, -0.3);
  sign.rotation.x = -0.12;
  (sign.material as THREE.MeshLambertMaterial).emissive = new THREE.Color('#ffffff');
  (sign.material as THREE.MeshLambertMaterial).emissiveMap = (sign.material as THREE.MeshLambertMaterial).map;
  (sign.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.65;
  const signBack = mesh(rbox(3.55, 1.12, 0.14, 0.08), mat('#2c1d59'));
  signBack.position.set(0, 4.35, -0.4);
  signBack.rotation.x = -0.12;
  g.add(signBack, sign);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? 0.26 : 0.6;
    if (i === 0) starShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else starShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const star = mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), gloss(PAL.gold, 90, 0.6));
  star.position.set(0, 5.35, -0.45);
  g.add(star);
  // two cabinets out front
  const screens: ArcadeScreen[] = [];
  [
    [-2.55, '#ff9ad5', 'DONUT DROP', '#6b2a7a'],
    [2.55, '#8fe3cf', 'SPRINKLES', '#1f5b6b'],
  ].forEach(([x, color, title, hue]) => {
    const cab = new THREE.Group();
    const body = mesh(rbox(0.95, 1.95, 0.85, 0.08), gloss(color as string, 40, 0.2));
    body.position.y = 0.98;
    const top = mesh(rbox(1.0, 0.35, 0.95, 0.06), mat('#2c1d59'));
    top.position.set(0, 2.0, 0.02);
    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ color: '#ffe08a' }));
    marquee.position.set(0, 2.0, 0.5);
    const screen = new ArcadeScreen(title as string, hue as string);
    screens.push(screen);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.56), new THREE.MeshBasicMaterial({ map: screen.tex }));
    scr.position.set(0, 1.55, 0.44);
    scr.rotation.x = -0.18;
    const panel = mesh(rbox(0.95, 0.12, 0.45, 0.04), mat('#3c2b6b'));
    panel.position.set(0, 1.08, 0.55);
    panel.rotation.x = 0.35;
    const stick = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), mat('#222'));
    stick.position.set(-0.2, 1.2, 0.58);
    const ball = mesh(new THREE.SphereGeometry(0.06, 8, 6), gloss('#ff5d8f', 90, 0.6));
    ball.position.set(-0.2, 1.3, 0.58);
    cab.add(body, top, marquee, scr, panel, stick, ball);
    for (let b = 0; b < 3; b++) {
      const btn = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), gloss(['#ffe08a', '#8ff0ff', '#ff9ad5'][b], 90, 0.5));
      btn.position.set(0.08 + b * 0.12, 1.15, 0.6);
      btn.rotation.x = 0.35;
      cab.add(btn);
    }
    cab.position.set(x as number, 0, 1.9);
    g.add(cab);
  });
  return { g, screens, neon: [neonPink, neonCyan, neonGold] };
}

function cardShop(): { g: THREE.Group; cards: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.add(mesh(rbox(5, 0.25, 4.2, 0.08), mat('#f3dcc0')).translateY(0.1).translateZ(-0.2));
  const counter = mesh(rbox(3.4, 1.1, 1.2, 0.12), mat(PAL.butter));
  counter.position.set(0, 0.75, -0.25);
  const top = mesh(rbox(3.6, 0.12, 1.4, 0.05), mat('#ffffff'));
  top.position.set(0, 1.35, -0.25);
  g.add(counter, top);
  for (const [x, z] of [
    [-1.9, 0.9],
    [1.9, 0.9],
    [-1.9, -1.4],
    [1.9, -1.4],
  ])
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 3, 8), mat('#ffffff')).translateX(x).translateY(1.5).translateZ(z));
  // striped tent roof
  const tent = new THREE.ConeGeometry(3.1, 1.3, 12, 1).toNonIndexed();
  const colors = new Float32Array(tent.attributes.position.count * 3);
  const a = new THREE.Color(PAL.butter);
  const b = new THREE.Color('#ffffff');
  for (let f = 0; f < tent.attributes.position.count / 3; f++) {
    const c = Math.floor(f / 2) % 2 ? a : b;
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  tent.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tent.computeVertexNormals();
  const roof = mesh(tent, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  roof.position.set(0, 3.55, -0.25);
  roof.scale.set(1, 1, 0.85);
  g.add(roof);
  const sign = signBoard('CARDS', 2.2, 0.7, { bg: '#fff8e6', fg: '#c08a24', border: '#ffe08a' });
  sign.position.set(0, 2.55, 1.0);
  g.add(sign);
  // floating holographic cards
  const cards: THREE.Mesh[] = [];
  const kinds: ['star' | 'heart' | 'gem', string, string][] = [
    ['heart', '#ffd1de', '#ffe9c9'],
    ['star', '#ffe9a8', '#ffd0e0'],
    ['gem', '#d9cdfd', '#c8f0f2'],
  ];
  kinds.forEach(([k, c1, c2], i) => {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.14), holoMaterial(cardTexture(k, c1, c2)));
    card.position.set(-1.05 + i * 1.05, 2.0, -0.25);
    card.userData.base = card.position.y;
    card.userData.phase = i * 1.3;
    cards.push(card);
    g.add(card);
  });
  return { g, cards };
}

function treasure(): { g: THREE.Group; lid: THREE.Group; glow: THREE.Sprite } {
  const g = new THREE.Group();
  const wood = mat('#c58f5e');
  const goldM = gloss(PAL.gold, 100, 0.7);
  const base = mesh(rbox(1.5, 0.85, 1.0, 0.06), wood);
  base.position.y = 0.45;
  g.add(base);
  for (const x of [-0.55, 0.55]) {
    const band = mesh(new THREE.BoxGeometry(0.12, 0.88, 1.04), goldM);
    band.position.set(x, 0.45, 0);
    g.add(band);
  }
  const lock = mesh(rbox(0.26, 0.3, 0.1, 0.04), goldM);
  lock.position.set(0, 0.72, 0.53);
  g.add(lock);
  const lid = new THREE.Group();
  lid.position.set(0, 0.88, -0.5);
  // a half-cylinder along x: rotating z by 90° turns the +x half into a dome on top
  const lidMesh = mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16, 1, false, 0, Math.PI), wood);
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.set(0, 0, 0.5);
  const lidCap = mesh(new THREE.BoxGeometry(1.5, 0.04, 1.0), wood);
  lidCap.position.set(0, 0.02, 0.5);
  lid.add(lidCap);
  lid.add(lidMesh);
  for (const x of [-0.55, 0.55]) {
    const band = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.12, 16, 1, false, 0, Math.PI), goldM);
    band.rotation.z = Math.PI / 2;
    band.position.set(x, 0, 0.5);
    lid.add(band);
  }
  g.add(lid);
  // X marks the spot
  for (const r of [0.6, -0.6]) {
    const x = mesh(new THREE.BoxGeometry(1.6, 0.04, 0.22), mat('#ff8f8f'), 'receive');
    x.position.set(0, 0.03, 1.5);
    x.rotation.y = r;
    g.add(x);
  }
  const glow = glowSprite('#ffe08a', 2.6, 0.0);
  glow.position.set(0, 1.2, 0);
  g.add(glow);
  const post = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 6), mat(PAL.woodDark));
  post.position.set(-1.5, 0.7, 0.9);
  const sign = signBoard('TREASURE', 1.6, 0.5, { bg: '#fff3dc', fg: '#a8642c', border: '#f2c46d' });
  sign.position.set(-1.5, 1.35, 0.97);
  g.add(post, sign);
  return { g, lid, glow };
}

function memoryBeach(): THREE.Group {
  const g = new THREE.Group();
  // the memory board
  for (const x of [-1.25, 1.25]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), mat(PAL.woodDark)).translateX(x).translateY(1.3).translateZ(-0.4));
  const board = mesh(rbox(2.9, 1.8, 0.14, 0.08), mat('#d9b48a'));
  board.position.set(0, 1.85, -0.4);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.68), new THREE.MeshLambertMaterial({ map: polaroidBoard() }));
  face.position.set(0, 1.85, -0.32);
  g.add(board, face);
  // umbrella + towel
  const umb = new THREE.Group();
  umb.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), mat('#ffffff')).translateY(1.3));
  const canopy = new THREE.ConeGeometry(1.6, 0.7, 12, 1).toNonIndexed();
  const cc = new Float32Array(canopy.attributes.position.count * 3);
  for (let f = 0; f < canopy.attributes.position.count / 3; f++) {
    const c = new THREE.Color(Math.floor(f / 2) % 2 ? '#ffffff' : '#f59ab8');
    for (let k = 0; k < 3; k++) cc.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  canopy.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  canopy.computeVertexNormals();
  const can = mesh(canopy, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  can.position.y = 2.55;
  umb.add(can);
  umb.position.set(-2.6, 0, 1);
  umb.rotation.z = 0.12;
  g.add(umb);
  const towel = mesh(rbox(1.1, 0.05, 2, 0.02), mat('#a9e3cf'), 'receive');
  towel.position.set(-2.1, 0.04, 1.4);
  towel.rotation.y = 0.3;
  const stripe = mesh(new THREE.BoxGeometry(1.12, 0.055, 0.3), mat('#ffffff'), 'receive');
  stripe.position.set(-2.1, 0.05, 1.4);
  stripe.rotation.y = 0.3;
  g.add(towel, stripe);
  // a sandcastle
  const castle = new THREE.Group();
  const sand = mat('#efd29e');
  castle.add(mesh(rbox(1.4, 0.5, 1.4, 0.08), sand).translateY(0.25));
  for (const [x, z] of [
    [-0.55, -0.55],
    [0.55, -0.55],
    [-0.55, 0.55],
    [0.55, 0.55],
  ]) {
    castle.add(mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.8, 10), sand).translateX(x).translateY(0.4).translateZ(z));
    castle.add(mesh(new THREE.ConeGeometry(0.3, 0.35, 10), mat('#f6c58f')).translateX(x).translateY(0.98).translateZ(z));
  }
  castle.add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.1, 10), sand).translateY(0.55));
  const flagPole = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), mat('#ffffff'));
  flagPole.position.y = 1.4;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshLambertMaterial({ color: '#ff7aa2', side: THREE.DoubleSide }));
  flag.position.set(0.15, 1.6, 0);
  castle.add(flagPole, flag);
  castle.position.set(2.7, 0, -1.6);
  g.add(castle);
  // postcards stuck in the sand
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group();
    p.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), mat(PAL.woodDark)).translateY(0.4));
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.41), new THREE.MeshLambertMaterial({ map: postcard(i), side: THREE.DoubleSide }));
    card.position.y = 0.95;
    p.add(card);
    p.position.set(-1.3 + i * 0.9, 0, 1.6 + (i % 2) * 0.5);
    p.rotation.y = (i - 1.5) * 0.25;
    g.add(p);
  }
  // bucket and spade
  const bucket = mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 12), mat('#8fd0f0'));
  bucket.position.set(1.4, 0.17, 1.6);
  g.add(bucket);
  return g;
}

/* ───────── the plaza ───────── */

function fountainSpray() {
  const n = 70;
  const seed = new Float32Array(n);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: holoUniforms.uTime, uMap: { value: softCircle() }, uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){
        float t = fract(uTime * 0.55 + seed);
        float a = seed * 6.2831 * 7.0;
        float r = t * (1.2 + seed * 0.6);
        vec3 p = vec3(cos(a) * r, 2.25 + t * 2.4 - t * t * 3.6, sin(a) * r);
        vA = (1.0 - t) * 0.85;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * (2.2 + seed * 2.0) * (30.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; varying float vA;
      void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(0.88, 0.97, 1.0), t.a * vA); }`,
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  return pts;
}

function fountain(): { g: THREE.Group; donut: THREE.Group; water: THREE.ShaderMaterial; spray: THREE.Points } {
  const g = new THREE.Group();
  const stone = mat('#f3e9f4');
  const stone2 = mat('#e6d8ec');
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.5, 40), stone2).translateY(0.25));
  const rim = mesh(new THREE.TorusGeometry(2.45, 0.28, 12, 48), stone);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.55;
  g.add(rim);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: holoUniforms.uTime },
    transparent: true,
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vP;
      void main(){
        float r = length(vP);
        float ring = smoothstep(0.75, 1.0, sin(r * 9.0 - uTime * 3.0)) * 0.4;
        vec3 c = mix(vec3(0.62, 0.9, 0.92), vec3(0.85, 0.98, 1.0), ring);
        gl_FragColor = vec4(c, 0.88);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.62;
  g.add(water);
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.5, 16), stone).translateY(1.2));
  const bowl = mesh(new THREE.CylinderGeometry(0.95, 0.35, 0.35, 24), stone);
  bowl.position.y = 2.0;
  g.add(bowl);
  const donut = donutMesh(cachedDonut('fountain', 0.55, 0.26, 'rainbow', 77, 1), mat(PAL.dough), gloss('#f6a4c0', 85, 0.45), sprinkleMat);
  donut.position.y = 2.95;
  g.add(donut);
  const spray = fountainSpray();
  g.add(spray);
  return { g, donut, water: waterMat, spray };
}

function lantern(color: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.1, 8), mat(PAL.woodDark)).translateY(1.05));
  const cap = mesh(new THREE.ConeGeometry(0.3, 0.25, 4), mat(PAL.woodDark));
  cap.position.y = 2.55;
  cap.rotation.y = Math.PI / 4;
  const boxMat = new THREE.MeshLambertMaterial({ color: '#fff6e8', emissive: new THREE.Color(color), emissiveIntensity: 0 });
  const box = mesh(rbox(0.34, 0.42, 0.34, 0.05), boxMat);
  box.position.y = 2.25;
  const glow = glowSprite(color, 2.2, 0);
  glow.position.y = 2.25;
  g.add(cap, box, glow);
  return { g, boxMat, glow };
}

function gift(): THREE.Group {
  const g = new THREE.Group();
  const box = mesh(rbox(1.5, 1.3, 1.5, 0.12), gloss('#f6a4c0', 60, 0.35));
  box.position.y = 0.65;
  const lidM = mesh(rbox(1.65, 0.3, 1.65, 0.1), gloss('#f6a4c0', 60, 0.35));
  lidM.position.y = 1.4;
  const ribbon = gloss('#fff3c4', 90, 0.6);
  g.add(box, lidM);
  g.add(mesh(new THREE.BoxGeometry(0.28, 1.58, 1.56), ribbon).translateY(0.78));
  g.add(mesh(new THREE.BoxGeometry(1.56, 1.58, 0.28), ribbon).translateY(0.78));
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 16), ribbon);
    loop.position.set(s * 0.32, 1.78, 0);
    loop.rotation.set(0, Math.PI / 2, s * 0.6);
    g.add(loop);
  }
  g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), ribbon).translateY(1.68));
  return g;
}

/* ───────── the whole set ───────── */

export class Landmarks {
  readonly group = new THREE.Group();
  readonly anchors: Anchor[] = [];
  readonly proxies: THREE.Mesh[] = [];
  private shopDonut!: THREE.Group;
  private shopLights: THREE.Mesh[] = [];
  private crystalGlows: THREE.Sprite[] = [];
  private crystalMats: THREE.MeshPhongMaterial[] = [];
  private screens: ArcadeScreen[] = [];
  private neon: THREE.MeshBasicMaterial[] = [];
  private cards: THREE.Mesh[] = [];
  private chestLid!: THREE.Group;
  private chestGlow!: THREE.Sprite;
  private fountainDonut!: THREE.Group;
  private spray!: THREE.Points;
  private lanterns: { id: Category; boxMat: THREE.MeshLambertMaterial; glow: THREE.Sprite; lit: number; target: number }[] = [];
  readonly gift: THREE.Group;
  private giftBeam: THREE.Mesh;
  private giftRise = 0;
  private giftTarget = 0;
  private giftPop = -1;
  private chestOpen = 0;
  private chestTarget = 0;
  private globe!: THREE.Mesh;
  readonly golden = new THREE.Group();
  private goldenY = 0;
  private screenClock = 0;

  constructor() {
    for (const l of LANDMARKS) {
      const y = terrainHeight(l.x, l.z);
      let node: THREE.Group;
      let labelY = 4;
      switch (l.id) {
        case 'note': {
          const s = donutShop();
          node = s.g;
          this.shopDonut = s.donut;
          this.shopLights = s.lights;
          labelY = 8;
          break;
        }
        case 'letter': {
          const c = crystalCove();
          node = c.g;
          this.crystalGlows = c.glows;
          this.crystalMats = c.mats;
          labelY = 4.2;
          break;
        }
        case 'clip': {
          const a = arcade();
          node = a.g;
          this.screens = a.screens;
          this.neon = a.neon;
          labelY = 6.4;
          break;
        }
        case 'card': {
          const c = cardShop();
          node = c.g;
          this.cards = c.cards;
          labelY = 5;
          break;
        }
        case 'capsule': {
          const t = treasure();
          node = t.g;
          this.chestLid = t.lid;
          this.chestGlow = t.glow;
          labelY = 2.6;
          break;
        }
        default:
          node = memoryBeach();
          labelY = 3.6;
      }
      node.position.set(l.x, y, l.z);
      node.rotation.y = l.rot;
      this.group.add(node);
      this.addProxy(l, y, labelY);
    }

    /* plaza */
    const py = terrainHeight(PLAZA.x, PLAZA.z);
    const f = fountain();
    f.g.position.set(PLAZA.x, py - 0.05, PLAZA.z);
    this.fountainDonut = f.donut;
    this.spray = f.spray;
    this.group.add(f.g);
    for (const L of LANTERNS) {
      const z = ZONES.find((zz) => zz.id === L.id)!;
      const lan = lantern(z.accent);
      lan.g.position.set(L.x, terrainHeight(L.x, L.z), L.z);
      this.group.add(lan.g);
      this.lanterns.push({ id: L.id, boxMat: lan.boxMat, glow: lan.glow, lit: 0, target: 0 });
    }
    this.gift = gift();
    this.gift.position.set(PLAZA.x, py - 2.2, PLAZA.z);
    this.group.add(this.gift);
    this.giftBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.3, 26, 24, 1, true),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: holoUniforms.uTime, uAmt: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uAmt; varying vec2 vUv;
          void main(){
            float a = (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.x * 40.0 + uTime * 2.0)) * uAmt * 0.45;
            gl_FragColor = vec4(vec3(1.0, 0.86, 0.95), a);
          }`,
      }),
    );
    this.giftBeam.position.set(PLAZA.x, py + 13, PLAZA.z);
    this.giftBeam.visible = false;
    this.group.add(this.giftBeam);
    this.anchors.push({ id: 'finale', kind: 'finale', pos: new THREE.Vector3(PLAZA.x, py + 0.6, PLAZA.z), labelY: 4.4 });
    this.addRawProxy('finale', new THREE.Vector3(PLAZA.x, py, PLAZA.z), 2.8, 3.6);

    /* dock */
    const dockGeos: THREE.BufferGeometry[] = [];
    for (let z = DOCK.z0; z < DOCK.z1; z += 0.46) {
      const plank = new THREE.BoxGeometry(DOCK.width, 0.12, 0.38);
      tint(plank, Math.round(z * 2) % 3 ? PAL.wood : '#c99a6c');
      place(plank, DOCK.x, DOCK.deckY - 0.06, z + 0.19);
      dockGeos.push(plank);
    }
    for (let z = DOCK.z0 + 0.6; z < DOCK.z1; z += 2.4) {
      for (const s of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.13, 0.15, 3.4, 8);
        tint(post, PAL.woodDark);
        place(post, DOCK.x + s * (DOCK.width / 2 + 0.05), DOCK.deckY - 1.4, z);
        dockGeos.push(post);
      }
    }
    const dock = new THREE.Mesh(merge(dockGeos), new THREE.MeshLambertMaterial({ vertexColors: true }));
    dock.castShadow = dock.receiveShadow = true;
    this.group.add(dock);
    const rowboat = new THREE.Group();
    const hull = mesh(new THREE.CapsuleGeometry(0.55, 1.6, 4, 10), gloss('#f6a4c0', 40, 0.2));
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1, 1, 0.45);
    rowboat.add(hull);
    rowboat.position.set(DOCK.x + 2.2, 0.05, DOCK.z1 - 2);
    this.group.add(rowboat);
    const lamp = lantern('#ffe08a');
    lamp.g.position.set(DOCK.x + DOCK.width / 2, DOCK.deckY, DOCK.z1 - 0.4);
    lamp.g.scale.setScalar(0.8);
    lamp.boxMat.emissiveIntensity = 0.4;
    this.group.add(lamp.g);
    this.lanterns.push({ id: 'dock' as Category, boxMat: lamp.boxMat, glow: lamp.glow, lit: 0, target: 0 });

    /* the world globe */
    const gy = terrainHeight(GLOBE.x, GLOBE.z);
    const globeGroup = new THREE.Group();
    globeGroup.add(mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.9, 12), mat('#f3e9f4')).translateY(0.45));
    this.globe = mesh(new THREE.SphereGeometry(0.75, 32, 20), new THREE.MeshLambertMaterial({ map: globeTexture() }));
    this.globe.position.y = 1.75;
    this.globe.rotation.z = 0.35;
    const ring = mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 40), gloss(PAL.gold, 90, 0.6));
    ring.position.y = 1.75;
    ring.rotation.set(Math.PI / 2 - 0.35, 0, 0);
    globeGroup.add(this.globe, ring);
    globeGroup.position.set(GLOBE.x, gy, GLOBE.z);
    this.group.add(globeGroup);
    this.anchors.push({ id: 'globe', kind: 'globe', pos: new THREE.Vector3(GLOBE.x, gy, GLOBE.z), labelY: 3 });
    this.addRawProxy('globe', new THREE.Vector3(GLOBE.x, gy, GLOBE.z), 1.1, 2.8);

    /* stepping stones */
    const stoneGeos = STONES.map((s, i) => {
      const geo = new THREE.CylinderGeometry(s.r * 0.95, s.r * 1.25, s.top + 3, 8, 1);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const j = 1 + Math.sin(k * 3.7 + i) * 0.06;
        pos.setXYZ(k, pos.getX(k) * j, pos.getY(k), pos.getZ(k) * j);
      }
      geo.computeVertexNormals();
      tint(geo, i % 2 ? PAL.rock : PAL.rock2);
      return place(geo, s.x, (s.top - 3) / 2, s.z, 0, i, 0);
    });
    const stones = new THREE.Mesh(merge(stoneGeos), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    stones.castShadow = stones.receiveShadow = true;
    this.group.add(stones);

    /* the golden donut */
    const gdy = groundHeight(GOLDEN.x, GOLDEN.z);
    const ped = mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.6, 7), mat(PAL.rock2));
    ped.position.set(GOLDEN.x, gdy + 0.3, GOLDEN.z);
    this.group.add(ped);
    const gd = donutMesh(cachedDonut('golden', 0.42, 0.2, 'stars', 9, 1), gloss('#e9b44c', 120, 0.9), gloss('#ffd970', 140, 1), sprinkleMat);
    this.golden.add(gd);
    const gg = glowSprite('#ffd970', 3, 0.7);
    this.golden.add(gg);
    this.goldenY = gdy + 1.5;
    this.golden.position.set(GOLDEN.x, this.goldenY, GOLDEN.z);
    this.group.add(this.golden);
    this.anchors.push({ id: 'golden', kind: 'golden', pos: new THREE.Vector3(GOLDEN.x, gdy, GOLDEN.z), labelY: 2.4 });

    const sh = blobShadow(1.2);
    sh.position.set(GLOBE.x, gy + 0.03, GLOBE.z);
    this.group.add(sh);
  }

  private addProxy(l: Landmark, y: number, labelY: number) {
    const pos = new THREE.Vector3(l.x, y, l.z);
    this.anchors.push({ id: l.id, kind: 'zone', zone: l.id, pos, labelY });
    this.addRawProxy(l.id, pos, l.pad * 0.75, labelY);
  }

  private addRawProxy(id: string, pos: THREE.Vector3, r: number, h: number) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), new THREE.MeshBasicMaterial());
    p.position.copy(pos).setY(pos.y + h / 2);
    p.visible = false;
    p.userData.anchor = id;
    this.proxies.push(p);
    this.group.add(p);
  }

  setLanterns(done: readonly string[], instant = false) {
    for (const l of this.lanterns) {
      if (l.id === ('dock' as Category)) continue;
      l.target = done.includes(l.id) ? 1 : 0;
      if (instant) l.lit = l.target;
    }
  }
  /** 0 = hidden under the fountain, 1 = risen and glowing (all quests done). */
  setGift(ready: boolean, instant = false) {
    this.giftTarget = ready ? 1 : 0;
    if (instant) this.giftRise = this.giftTarget;
  }
  /** The finale: the gift bursts open (and quietly reappears later so the finale can be replayed). */
  popGift() {
    this.giftPop = 0;
  }
  openChest(open: boolean) {
    this.chestTarget = open ? 1 : 0;
  }
  setGolden(visible: boolean) {
    this.golden.visible = visible;
  }
  get giftReady() {
    return this.giftRise > 0.95;
  }

  update(dt: number, time: number, night: number, pointScale: number) {
    holoUniforms.uTime.value = time;
    (this.spray.material as THREE.ShaderMaterial).uniforms.uScale.value = pointScale;
    this.shopDonut.rotation.y = time * 0.6;
    this.fountainDonut.rotation.y = -time * 0.8;
    this.globe.rotation.y = time * 0.25;
    this.golden.rotation.y = time * 1.6;
    this.golden.position.y = this.goldenY + Math.sin(time * 2) * 0.15;
    for (const c of this.cards) {
      c.position.y = (c.userData.base as number) + Math.sin(time * 1.5 + (c.userData.phase as number)) * 0.12;
      c.rotation.y = Math.sin(time * 0.7 + (c.userData.phase as number)) * 0.6;
    }
    const glowBoost = 0.45 + night * 0.55;
    this.crystalGlows.forEach((g, i) => {
      (g.material as THREE.SpriteMaterial).opacity = glowBoost * (0.7 + 0.3 * Math.sin(time * 2 + i));
    });
    for (const m of this.crystalMats) m.emissiveIntensity = 0.25 + night * 0.55;
    this.shopLights.forEach((b, i) => b.scale.setScalar(1 + night * (0.4 + 0.2 * Math.sin(time * 3 + i))));
    this.neon.forEach((m, i) => m.color.setHSL([0.9, 0.52, 0.13][i], 1, 0.74 + Math.sin(time * 4 + i) * 0.04));
    this.screenClock += dt;
    if (this.screenClock > 0.12) {
      this.screenClock = 0;
      for (const s of this.screens) s.draw(time);
    }
    for (const l of this.lanterns) {
      l.lit += (l.target - l.lit) * Math.min(1, dt * 2.5);
      const base = l.id === ('dock' as Category) ? night : l.lit;
      l.boxMat.emissiveIntensity = base * (0.9 + night * 0.6);
      (l.glow.material as THREE.SpriteMaterial).opacity = base * (0.5 + night * 0.4) * (0.85 + Math.sin(time * 3 + l.boxMat.id) * 0.15);
    }
    // the finale gift rising from the fountain
    this.giftRise += (this.giftTarget - this.giftRise) * Math.min(1, dt * 0.9);
    const py = terrainHeight(PLAZA.x, PLAZA.z);
    this.gift.position.y = py - 2.4 + this.giftRise * 4.4 + (this.giftRise > 0.9 ? Math.sin(time * 1.6) * 0.12 : 0);
    this.gift.rotation.y = time * 0.4;
    let giftScale = 1;
    if (this.giftPop >= 0) {
      this.giftPop += dt;
      const p = this.giftPop;
      giftScale = p < 0.25 ? 1 + p * 1.6 : p < 0.5 ? 1.4 * (1 - (p - 0.25) / 0.25) : p < 14 ? 0 : Math.min(1, (p - 14) / 0.8);
      if (p > 15) this.giftPop = -1;
    }
    this.gift.scale.setScalar(Math.max(0.001, giftScale));
    this.gift.visible = this.giftRise > 0.02 && giftScale > 0.002;
    this.fountainDonut.visible = this.giftRise < 0.5;
    this.giftBeam.visible = this.giftRise > 0.6;
    ((this.giftBeam.material as THREE.ShaderMaterial).uniforms.uAmt as { value: number }).value = Math.max(0, (this.giftRise - 0.6) / 0.4);
    // the treasure chest lid
    this.chestOpen += (this.chestTarget - this.chestOpen) * Math.min(1, dt * 3);
    this.chestLid.rotation.x = -this.chestOpen * 1.9;
    (this.chestGlow.material as THREE.SpriteMaterial).opacity = this.chestOpen * 0.9 + night * 0.1;
  }
}

/* The player: a fictional, stylized chibi avatar (not a likeness of anyone), in the original
 * island's colours — mauve hair, pink top, indigo leggings, a donut in hand.
 * Everything is animated procedurally: walk cycle, idle breathing, blinks, jumps, waves. */
import * as THREE from 'three';
import { PAL, blobShadow, gloss, mat } from '../mats';
import { cachedDonut, donutMesh, sprinkleMat } from './donutGeo';

const SKIN = '#f6cdb0';
const HAIR = '#79505f';
const SHIRT = '#e399bd';
const PANTS = '#62618a';

export class Avatar {
  readonly root = new THREE.Group();
  /** the visual body (squash & stretch happens here, not on root) */
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  private shadow: THREE.Mesh;
  private phase = 0;
  private blinkT = 2;
  private squash = 0;
  private waveT = 0;
  private cheerT = 0;
  /** 0 idle … 1 running */
  speed01 = 0;
  airborne = false;

  constructor() {
    const skin = mat(SKIN);
    const hair = gloss(HAIR, 30, 0.15);
    const shirt = mat(SHIRT);
    const pants = mat(PANTS);
    const shoe = mat('#fff6ef');
    const dark = mat('#3d3346');

    /* legs (pivot at the hip) */
    for (const [leg, x] of [
      [this.legL, -0.11],
      [this.legR, 0.11],
    ] as const) {
      leg.position.set(x, 0.42, 0);
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 3, 8), pants);
      l.position.y = -0.17;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), shoe);
      foot.scale.set(1, 0.6, 1.35);
      foot.position.set(0, -0.36, 0.035);
      leg.add(l, foot);
      l.castShadow = foot.castShadow = true;
      this.body.add(leg);
    }

    /* flared top */
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.29, 0.42, 18), shirt);
    torso.position.y = 0.6;
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 10), shirt);
    shoulders.scale.set(1.05, 0.7, 0.9);
    shoulders.position.y = 0.8;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 16), mat('#fff3f7'));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.9;
    torso.castShadow = shoulders.castShadow = true;
    this.body.add(torso, shoulders, collar);

    /* arms (pivot at the shoulder) */
    for (const [arm, x] of [
      [this.armL, -0.22],
      [this.armR, 0.22],
    ] as const) {
      arm.position.set(x, 0.84, 0);
      const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), shirt);
      sleeve.position.y = -0.03;
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.2, 3, 8), skin);
      a.position.y = -0.17;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skin);
      hand.position.y = -0.31;
      arm.add(sleeve, a, hand);
      a.castShadow = true;
      arm.rotation.z = x < 0 ? -0.12 : 0.12;
      this.body.add(arm);
    }
    // a little donut in the right hand
    const dg = cachedDonut('avatar', 0.11, 0.055, 'rainbow', 7, 0.6);
    const donut = donutMesh(dg, mat(PAL.dough), gloss('#f6a4c0', 80, 0.4), sprinkleMat);
    donut.position.set(0.04, -0.36, 0.08);
    donut.rotation.y = -0.4;
    this.armR.add(donut);

    /* head */
    this.head.position.y = 1.18;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), skin);
    face.castShadow = true;
    // hair: a cap over the top + back, a fringe, and long hair behind
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.365, 28, 16, 0, Math.PI * 2, 0, 1.25), hair);
    cap.position.y = 0.012;
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 16, Math.PI, Math.PI, 0.9, 1.5), hair);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.372, 24, 10, 0.35 * Math.PI, 0.3 * Math.PI, 0.5, 0.62), hair);
    const sideL = new THREE.Mesh(new THREE.SphereGeometry(0.373, 12, 10, 0.08 * Math.PI, 0.2 * Math.PI, 0.55, 1.1), hair);
    const sideR = new THREE.Mesh(new THREE.SphereGeometry(0.373, 12, 10, 0.72 * Math.PI, 0.2 * Math.PI, 0.55, 1.1), hair);
    const long = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), hair);
    long.scale.set(1.08, 1.25, 0.6);
    long.position.set(0, -0.3, -0.14);
    cap.castShadow = long.castShadow = true;
    this.head.add(face, cap, back, fringe, sideL, sideR, long);
    // a donut hair clip
    const clip = donutMesh(cachedDonut('clip', 0.065, 0.03, 'none', 3, 0.5), mat(PAL.dough), gloss('#ffd36e', 80, 0.5), sprinkleMat);
    clip.position.set(0.26, 0.2, 0.17);
    clip.rotation.set(0, 0.6, 0.3);
    this.head.add(clip);
    // eyes, sparkles, blush, smile
    for (const x of [-0.12, 0.12]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), dark);
      e.scale.set(0.9, 1.3, 0.55);
      e.position.set(x, -0.02, 0.315);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }));
      s.position.set(x + 0.016, 0.0, 0.338);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshBasicMaterial({ color: '#f59ab4', transparent: true, opacity: 0.55, depthWrite: false }));
      blush.position.set(x * 1.62, -0.1, 0.29);
      blush.rotation.y = Math.atan2(blush.position.x, blush.position.z);
      this.eyes.push(e);
      this.head.add(e, s, blush);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.01, 6, 14, Math.PI), mat('#b95f74'));
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.12, 0.322);
    this.head.add(smile);
    this.body.add(this.head);

    this.shadow = blobShadow(1.05);
    this.shadow.position.y = 0.03;
    this.root.add(this.body, this.shadow);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = false;
    });
  }

  /** Called on take-off and landing for a little squash & stretch. */
  bounce(amount: number) {
    this.squash = amount;
  }
  wave(seconds = 2.2) {
    this.waveT = seconds;
  }
  cheer(seconds = 1.4) {
    this.cheerT = seconds;
  }

  /** groundGap: distance between feet and ground (shrinks the blob shadow while airborne). */
  update(dt: number, time: number, groundGap: number) {
    const s = this.speed01;
    this.phase += dt * (5 + s * 7) * (s > 0.02 ? 1 : 0);
    const swing = Math.sin(this.phase) * 0.75 * Math.min(1, s * 1.6);
    const air = this.airborne;
    this.legL.rotation.x = air ? -0.5 : swing;
    this.legR.rotation.x = air ? 0.3 : -swing;
    let armL = air ? -2.4 : -swing * 0.8;
    let armR = air ? -2.2 : swing * 0.8;
    let armLz = -0.12;
    let armRz = 0.12;
    if (this.waveT > 0 && !air) {
      this.waveT -= dt;
      armR = -2.6;
      armRz = 0.35 + Math.sin(time * 12) * 0.35;
    }
    if (this.cheerT > 0) {
      this.cheerT -= dt;
      armL = armR = -2.8;
      armLz = -0.4;
      armRz = 0.4;
    }
    this.armL.rotation.x += (armL - this.armL.rotation.x) * Math.min(1, dt * 14);
    this.armR.rotation.x += (armR - this.armR.rotation.x) * Math.min(1, dt * 14);
    this.armL.rotation.z += (armLz - this.armL.rotation.z) * Math.min(1, dt * 14);
    this.armR.rotation.z += (armRz - this.armR.rotation.z) * Math.min(1, dt * 14);

    const bob = air ? 0 : Math.abs(Math.sin(this.phase)) * 0.06 * Math.min(1, s * 1.5);
    const breathe = Math.sin(time * 2.2) * 0.012 * (1 - s);
    this.body.position.y = bob;
    this.body.rotation.x = s * 0.12;
    this.head.rotation.z = Math.sin(time * 1.1) * 0.04 * (1 - s);
    this.head.position.y = 1.18 + breathe;

    // squash & stretch
    this.squash += (0 - this.squash) * Math.min(1, dt * 9);
    const sq = this.squash;
    this.body.scale.set(1 + sq * 0.18, 1 - sq * 0.22 + breathe, 1 + sq * 0.18);

    // blinking
    this.blinkT -= dt;
    const closed = this.blinkT < 0.12;
    for (const e of this.eyes) e.scale.y = closed ? 0.15 : 1.3;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;

    // shadow shrinks while airborne
    const k = Math.max(0.35, 1 - groundGap * 0.35);
    this.shadow.scale.setScalar(1.05 * k);
    this.shadow.position.y = 0.03 - groundGap;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.24 * k;
  }
}

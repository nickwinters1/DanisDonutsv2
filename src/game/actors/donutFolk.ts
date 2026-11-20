/* The Donuts: every approved community message becomes a little donut friend who hops around
 * the island in the frosting and sprinkles its author picked. Walk up to one to read their note.
 * "Glaze", the island guide, is the one exception: a fictional helper with a party hat. */
import * as THREE from 'three';
import { PAL, blobShadow, gloss, mat } from '../mats';
import { cachedDonut, donutMesh, sprinkleMat } from './donutGeo';
import { blocked, groundHeight, hashString, rng, walkable, type V2 } from '../layout';
import type { SprinkleStyle } from '../../data/types';

export interface FolkSpec {
  id: string;
  name: string;
  frosting: string;
  sprinkles: SprinkleStyle;
  home: V2;
  guide?: boolean;
}

export class DonutFolk {
  readonly root = new THREE.Group();
  readonly spec: FolkSpec;
  private body = new THREE.Group();
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private eyes: THREE.Mesh[] = [];
  private shadow: THREE.Mesh;
  private target: V2;
  private wait = 0;
  private hop = 0;
  private blinkT = 1;
  private heading = 0;
  private rand: () => number;
  /** set by the game when the player is close */
  attention = false;
  talking = false;
  readonly pos = new THREE.Vector3();

  constructor(spec: FolkSpec) {
    this.spec = spec;
    const seed = hashString(spec.id);
    this.rand = rng(seed);
    const R = 0.3;
    const tube = 0.17;
    const dg = cachedDonut(`folk-${spec.sprinkles}-${seed % 5}`, R, tube, spec.sprinkles, (seed % 5) + 11, 0.8);
    const donut = donutMesh(dg, mat(PAL.dough), gloss(spec.frosting, 75, 0.38), sprinkleMat);
    this.body.add(donut);

    const dark = mat('#3d3346');
    for (const x of [-0.09, 0.09]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), dark);
      e.scale.set(0.9, 1.25, 0.6);
      e.position.set(x * 1.05, 0.29, 0.196);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.7 }));
      s.position.set(x * 1.05 + 0.016, 0.31, 0.226);
      const cheek = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 12),
        new THREE.MeshBasicMaterial({ color: '#ff8fae', transparent: true, opacity: 0.5, depthWrite: false }),
      );
      cheek.position.set(x * 1.95, 0.215, 0.172);
      this.eyes.push(e);
      this.body.add(e, s, cheek);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), mat('#8b3f5c'));
    smile.rotation.z = Math.PI;
    smile.position.set(0, 0.215, 0.178);
    this.body.add(smile);

    const dough = mat(PAL.doughDark);
    const armGeo = new THREE.CapsuleGeometry(0.045, 0.14, 2, 6);
    this.armL = new THREE.Mesh(armGeo, dough);
    this.armR = new THREE.Mesh(armGeo, dough);
    this.armL.position.set(-0.47, -0.02, 0.02);
    this.armR.position.set(0.47, -0.02, 0.02);
    this.armL.rotation.z = -0.9;
    this.armR.rotation.z = 0.9;
    for (const x of [-0.12, 0.12]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), dough);
      f.scale.set(1, 0.6, 1.35);
      f.position.set(x, -0.5, 0.03);
      this.body.add(f);
    }
    this.body.add(this.armL, this.armR);

    if (spec.guide) {
      // a striped party hat and a little bow tie for the guide
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 14), gloss('#a99cf0', 50, 0.3));
      hat.position.set(0.05, 0.6, 0.02);
      hat.rotation.z = -0.25;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#fff3a8'));
      pom.position.set(0.09, 0.76, 0.02);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 6, 10), mat('#ff7aa2'));
      bow.scale.set(1.6, 0.8, 1);
      bow.position.set(0, -0.2, 0.2);
      this.body.add(hat, pom, bow);
    }

    this.body.position.y = 0.6;
    this.body.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.shadow = blobShadow(0.95);
    this.shadow.position.y = 0.03;
    this.root.add(this.body, this.shadow);

    this.pos.set(spec.home.x, groundHeight(spec.home.x, spec.home.z), spec.home.z);
    this.root.position.copy(this.pos);
    this.target = { ...spec.home };
    this.wait = this.rand() * 3;
    this.heading = this.rand() * Math.PI * 2;
  }

  private pickTarget() {
    for (let i = 0; i < 12; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 1.5 + this.rand() * (this.spec.guide ? 2.5 : 4.5);
      const x = this.spec.home.x + Math.cos(a) * r;
      const z = this.spec.home.z + Math.sin(a) * r;
      if (walkable(x, z) && groundHeight(x, z) > 0.05 && !blocked(x, z, 0.5)) {
        this.target = { x, z };
        return;
      }
    }
    this.target = { ...this.spec.home };
  }

  /** player: where the player is (to look at them when close). */
  update(dt: number, time: number, player: THREE.Vector3) {
    const toPlayer = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    let moving = false;
    let wantHeading = this.heading;
    if (this.attention || this.talking) {
      wantHeading = Math.atan2(player.x - this.pos.x, player.z - this.pos.z);
    } else if (this.wait > 0) {
      this.wait -= dt;
    } else {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        this.wait = 1.5 + this.rand() * 4;
        this.pickTarget();
      } else {
        const step = Math.min(d, dt * 1.25);
        const nx = this.pos.x + (dx / d) * step;
        const nz = this.pos.z + (dz / d) * step;
        // keep a polite distance from the player and stay on land
        if (walkable(nx, nz) && !blocked(nx, nz, 0.45) && Math.hypot(player.x - nx, player.z - nz) > 1.1) {
          this.pos.x = nx;
          this.pos.z = nz;
          moving = true;
        } else {
          this.wait = 0.6;
          this.pickTarget();
        }
        wantHeading = Math.atan2(dx, dz);
      }
    }
    // smooth turning
    const diff = Math.atan2(Math.sin(wantHeading - this.heading), Math.cos(wantHeading - this.heading));
    this.heading += diff * Math.min(1, dt * 6);

    this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;

    // hop while walking, wobble while idle, bounce when chatting
    if (moving) this.hop += dt * 9;
    const hopY = moving ? Math.abs(Math.sin(this.hop)) * 0.22 : 0;
    const contact = moving ? 1 - Math.min(1, Math.abs(Math.sin(this.hop)) * 4) : 0;
    const talk = this.talking ? Math.abs(Math.sin(time * 7)) * 0.06 : 0;
    this.body.position.y = 0.6 + hopY + talk;
    this.body.scale.set(1 + contact * 0.1, 1 - contact * 0.12 + Math.sin(time * 2.4 + this.heading) * 0.015, 1 + contact * 0.1);
    this.body.rotation.z = moving ? Math.sin(this.hop) * 0.08 : Math.sin(time * 1.3 + this.heading) * 0.04;
    const wave = this.attention || this.talking ? Math.sin(time * 10) * 0.5 : 0;
    this.armL.rotation.z = -0.9 - (moving ? Math.sin(this.hop) * 0.3 : 0);
    this.armR.rotation.z = 0.9 + (this.attention || this.talking ? 1.1 + wave : moving ? Math.sin(this.hop) * 0.3 : 0);

    this.blinkT -= dt;
    for (const e of this.eyes) e.scale.y = this.blinkT < 0.1 ? 0.15 : 1.25;
    if (this.blinkT < 0) this.blinkT = 1.8 + this.rand() * 3.5;

    this.shadow.scale.setScalar(0.95 * (1 - hopY * 0.8));
    this.shadow.position.y = 0.03 - hopY * 0;
    return toPlayer;
  }
}

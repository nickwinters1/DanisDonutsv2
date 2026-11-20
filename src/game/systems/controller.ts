/* Player movement: walking, sprinting, jumping, wading, collisions and falling into the sea. */
import * as THREE from 'three';
import { ALL_COLLIDERS, WADE_LIMIT, groundHeight, type V2 } from '../layout';

export interface MoveInput {
  /** world-space direction, length 0..1 */
  x: number;
  z: number;
  run: boolean;
  jump: boolean;
}

export interface MoveEvents {
  jumped: boolean;
  landed: number;
  fell: boolean;
  step: boolean;
  wading: boolean;
  arrived: boolean;
}

const RADIUS = 0.36;
const WALK = 4.4;
const RUN = 7.2;
const JUMP_V = 7.6;
const GRAVITY = 22;
const STEP_UP = 0.62;
const STEP_DOWN = 1.6;
const BOUND_X = 60;
const BOUND_Z = 42;

export class Controller {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  vy = 0;
  grounded = true;
  heading = Math.PI;
  speed01 = 0;
  private lastSafe = new THREE.Vector3();
  private stepClock = 0;
  private fallTimer = 0;
  path: V2[] | null = null;
  /** dynamic obstacles (Donuts), refreshed by the game every frame */
  dynamic: { x: number; z: number; r: number }[] = [];

  place(x: number, z: number, heading = Math.PI) {
    this.pos.set(x, groundHeight(x, z), z);
    this.lastSafe.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.heading = heading;
    this.path = null;
  }

  get falling() {
    return this.fallTimer > 0;
  }

  private pushOut(p: THREE.Vector3) {
    for (let iter = 0; iter < 2; iter++) {
      for (const c of ALL_COLLIDERS) this.resolve(p, c.x, c.z, c.r);
      for (const c of this.dynamic) this.resolve(p, c.x, c.z, c.r);
    }
  }
  private resolve(p: THREE.Vector3, cx: number, cz: number, cr: number) {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const min = cr + RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * min;
      p.z = cz + (dz / d) * min;
    }
  }

  private canStand(x: number, z: number, fromY: number) {
    const h = groundHeight(x, z);
    if (h <= WADE_LIMIT) return false;
    if (h - fromY > STEP_UP) return false;
    if (fromY - h > STEP_DOWN) return false;
    return true;
  }

  update(dt: number, input: MoveInput): MoveEvents {
    const ev: MoveEvents = { jumped: false, landed: 0, fell: false, step: false, wading: false, arrived: false };
    if (this.fallTimer > 0) {
      this.fallTimer -= dt;
      this.vy -= GRAVITY * 0.25 * dt;
      this.pos.y += this.vy * dt;
      if (this.fallTimer <= 0) this.place(this.lastSafe.x, this.lastSafe.z, this.heading);
      return ev;
    }

    let ix = input.x;
    let iz = input.z;
    // follow a tap-to-walk path when there's no manual input
    if (Math.hypot(ix, iz) > 0.1) this.path = null;
    else if (this.path?.length) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x;
      const dz = wp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < (this.path.length === 1 ? 0.35 : 0.6)) {
        this.path.shift();
        if (!this.path.length) {
          this.path = null;
          ev.arrived = true;
        }
      } else {
        ix = dx / d;
        iz = dz / d;
      }
    }

    const ground = groundHeight(this.pos.x, this.pos.z);
    const wading = this.grounded && ground < -0.05;
    ev.wading = wading;
    const len = Math.min(1, Math.hypot(ix, iz));
    const max = (input.run ? RUN : WALK) * (wading ? 0.62 : 1);
    const tx = len > 0.01 ? (ix / Math.hypot(ix, iz)) * len * max : 0;
    const tz = len > 0.01 ? (iz / Math.hypot(ix, iz)) * len * max : 0;
    const accel = this.grounded ? 12 : 4;
    const k = 1 - Math.exp(-dt * accel);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.speed01 = Math.min(1, sp / RUN);
    if (sp > 0.3) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      this.heading += diff * Math.min(1, dt * 12);
    }

    if (input.jump && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
      ev.jumped = true;
    }

    // horizontal move with sliding
    const cand = new THREE.Vector3(this.pos.x + this.vel.x * dt, this.pos.y, this.pos.z + this.vel.z * dt);
    this.pushOut(cand);
    cand.x = THREE.MathUtils.clamp(cand.x, -BOUND_X, BOUND_X);
    cand.z = THREE.MathUtils.clamp(cand.z, -BOUND_Z, BOUND_Z);
    if (this.grounded) {
      if (this.canStand(cand.x, cand.z, this.pos.y)) {
        this.pos.x = cand.x;
        this.pos.z = cand.z;
      } else if (this.canStand(cand.x, this.pos.z, this.pos.y)) {
        this.pos.x = cand.x;
        this.vel.z *= 0.5;
      } else if (this.canStand(this.pos.x, cand.z, this.pos.y)) {
        this.pos.z = cand.z;
        this.vel.x *= 0.5;
      } else {
        this.vel.x *= 0.2;
        this.vel.z *= 0.2;
        if (this.path) this.path = null;
      }
      const h = groundHeight(this.pos.x, this.pos.z);
      this.pos.y += (h - this.pos.y) * Math.min(1, dt * 20);
      if (h > 0.05) this.lastSafe.copy(this.pos).setY(h);
      if (sp > 0.6) {
        this.stepClock += dt * (sp / 2.2);
        if (this.stepClock > 1) {
          this.stepClock = 0;
          ev.step = true;
        }
      }
    } else {
      this.pos.x = cand.x;
      this.pos.z = cand.z;
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      const h = groundHeight(this.pos.x, this.pos.z);
      if (this.vy < 0) {
        if (h > WADE_LIMIT) {
          if (this.pos.y <= h) {
            ev.landed = -this.vy;
            this.pos.y = h;
            this.vy = 0;
            this.grounded = true;
          }
        } else if (this.pos.y <= 0.0) {
          // splash! back to the last safe spot
          ev.fell = true;
          this.fallTimer = 0.9;
          this.vy = -1;
          this.grounded = true;
          this.vel.set(0, 0, 0);
        }
      }
    }
    return ev;
  }
}

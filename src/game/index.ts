/* Dani's Donut Island — the playable 3D island.
 * One renderer and one scene serve two modes:
 *  • diorama: the slowly turning island in the page hero (drag to spin it)
 *  • play:    full-screen third-person adventure with quests, Donuts, sprinkles and a finale
 * Everything is procedural: no models, textures or audio files are downloaded. */
import * as THREE from 'three';
import { Sky } from './world/sky';
import { buildHeightTexture, buildTerrain } from './world/terrain';
import { buildWater } from './world/water';
import { Props } from './world/props';
import { Landmarks } from './world/landmarks';
import { Bottles, Sprinkles } from './world/collectibles';
import { Avatar } from './actors/avatar';
import { DonutFolk, type FolkSpec } from './actors/donutFolk';
import { Fireworks, Particles, SkyLanterns } from './fx/particles';
import { Controller } from './systems/controller';
import { Input } from './systems/input';
import { findPath } from './systems/pathfind';
import { Hud, Labels, zoneLabel } from './hud';
import { FrameGovernor, detectQuality } from './quality';
import { GLOBE, GOLDEN, LANDMARKS, PLAZA, SPAWN, blocked, groundHeight, hashString, landmarkById, walkable, type V2 } from './layout';
import { FROSTINGS, ZONES, zoneById, type AttractionId } from '../data/catalog';
import type { Category, Message, SprinkleStyle } from '../data/types';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { get, save } from '../lib/storage';
import { islandMapHTML } from '../ui/islandMap';
import { esc, reducedMotion } from '../ui/dom';

export interface IslandHost {
  getMessages(): Message[];
  isRevealed(): boolean;
  /** Open the attraction that belongs to a destination (the page shows it in a dialog). */
  openZone(zone: Category): void;
  openMessage(m: Message, via: 'npc' | 'bottle'): void;
  openAttraction(id: AttractionId): void;
  /** Revealed + all six quests done? */
  canFinale(): boolean;
  showFinaleLetter(): void;
  toast(text: string): void;
  /** Player pressed "Back to the page". */
  requestExit(): void;
}

type Mode = 'diorama' | 'play' | 'cinematic';

interface Target {
  kind: 'zone' | 'globe' | 'finale' | 'npc';
  id: string;
  label: string;
  dist: number;
  locked?: boolean;
  act: () => void;
}

const GUIDE_TIPS = [
  'Hi, I’m Glaze! Welcome to Donut Island 🍩',
  'Visit all six places to light the six lanterns around this fountain.',
  'Sprinkles are worth XP. There are 40 hidden all over the island!',
  'Bottles wash up on the beaches. Each one carries a little note.',
  'Psst… something golden glimmers on a tiny island to the east. You’ll have to jump!',
  'When all six lanterns glow, come back here for a surprise.',
];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class IslandGame {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1400);
  private quality = detectQuality();
  private governor: FrameGovernor;
  private sky = new Sky();
  private water!: ReturnType<typeof buildWater>;
  private props!: Props;
  private landmarks!: Landmarks;
  private sprinkles!: Sprinkles;
  private bottles!: Bottles;
  private avatar = new Avatar();
  private folk = new Map<string, { npc: DonutFolk; message: Message | null; proxy: THREE.Mesh }>();
  private glow = new Particles(1600, true);
  private puffs = new Particles(500, false);
  private fireworks: Fireworks;
  private skyLanterns = new SkyLanterns(90);
  private ctl = new Controller();
  private input!: Input;
  private hud!: Hud;
  private labels!: Labels;
  private raycaster = new THREE.Raycaster();
  private mode: Mode = 'diorama';
  private time = 0;
  private last = performance.now();
  private raf = 0;
  private heroEl: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private stage: HTMLElement | null = null;
  private heroVisible = true;
  private paused = false;
  private resizeObs: ResizeObserver;
  private pointScale = 1;
  private reduced = reducedMotion();
  private dirty = true;
  private skip = 0;
  /* camera */
  private camPos = new THREE.Vector3(60, 40, 60);
  private camLook = new THREE.Vector3();
  private camFrom: { pos: THREE.Vector3; look: THREE.Vector3; t: number; dur: number } | null = null;
  private orbitYaw = 0.6;
  private orbitDrag: { x: number; yaw: number } | null = null;
  private camYaw = 0;
  private cine: { t: number; fired: Set<string> } | null = null;
  /* gameplay */
  private target: Target | null = null;
  private pendingAct: string | null = null;
  private combo = 0;
  private comboT = 0;
  private guideTip = 0;
  private guideBubbleT = 0;
  private saveT = 0;
  private hintT = 0;
  private hoverT = 0;
  private finaleSeen = progress.state.finale;
  /** after the finale the island stays a starry night; the pause menu can bring the day back */
  private dayOverride = false;
  private resolveReady!: () => void;
  readonly ready = new Promise<void>((r) => (this.resolveReady = r));

  constructor(private host: IslandHost) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'island-canvas';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.quality.antialias, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.quality.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.governor = new FrameGovernor(this.quality, (dpr) => {
      this.renderer.setPixelRatio(dpr);
      this.resize();
    });
    this.fireworks = new Fireworks(
      this.glow,
      (pos) => sound.boom(pos.distanceTo(this.camera.position) / 45),
      () => sound.launch(),
    );
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.host.toast('The 3D island took a nap. Reload the page to wake it up.');
    });
  }

  /** Builds the world in a few steps, yielding so the page stays responsive. */
  async build() {
    const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
    const s = this.scene;
    s.add(this.sky.group, this.sky.hemi, this.sky.sun, this.sky.sun.target);
    const sun = this.sky.sun;
    sun.castShadow = this.quality.shadows;
    sun.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    this.setShadowBox(48);
    await yieldFrame();
    s.add(buildTerrain());
    this.water = buildWater(buildHeightTexture(), this.sky);
    s.add(this.water.mesh);
    await yieldFrame();
    this.props = new Props({ grass: this.quality.grass, flowers: this.quality.flowers });
    s.add(this.props.group);
    await yieldFrame();
    this.landmarks = new Landmarks();
    s.add(this.landmarks.group);
    await yieldFrame();
    this.sprinkles = new Sprinkles(progress.state.sprinkles);
    this.bottles = new Bottles(3);
    s.add(this.sprinkles.group, this.bottles.group, this.glow.points, this.puffs.points, this.skyLanterns.group);
    this.avatar.root.traverse((o) => ((o as THREE.Mesh).castShadow = (o as THREE.Mesh).isMesh));
    s.add(this.avatar.root);
    this.landmarks.setGolden(!progress.state.golden);
    this.syncProgress(true);
    this.ctl.place(SPAWN.x, SPAWN.z, Math.PI);
    this.avatar.root.position.copy(this.ctl.pos);
    this.avatar.root.rotation.y = 0;
    this.addGuide();
    this.syncFolk();
    progress.onChange(() => this.syncProgress());
    this.resolveReady();
  }

  /* ───────── mounting ───────── */

  /** Shows the island as a turning diorama inside the hero. */
  mountHero(el: HTMLElement) {
    this.heroEl = el;
    el.prepend(this.canvas);
    this.observe(el);
    const io = new IntersectionObserver((entries) => {
      this.heroVisible = entries[0]?.isIntersecting ?? true;
      this.dirty = true;
    });
    io.observe(el);
    // drag to spin
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'diorama' || (e.target as HTMLElement).closest('button,a')) return;
      this.orbitDrag = { x: e.clientX, yaw: this.orbitYaw };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.orbitDrag) return;
      this.orbitYaw = this.orbitDrag.yaw - (e.clientX - this.orbitDrag.x) * 0.006;
      this.dirty = true;
    });
    const up = () => (this.orbitDrag = null);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    this.setMode('diorama');
    this.start();
  }

  private observe(el: HTMLElement) {
    this.resizeObs.disconnect();
    this.resizeObs.observe(el);
    this.resize();
  }

  private resize() {
    const host = this.canvas.parentElement;
    if (!host) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.pointScale = buf.y / 820;
    for (const p of [this.glow, this.puffs]) p.uniforms.uScale.value = this.pointScale;
    this.props?.setPointScale(this.pointScale);
    this.sprinkles?.setPointScale(this.pointScale);
    this.dirty = true;
  }

  private setShadowBox(half: number) {
    const c = this.sky.sun.shadow.camera;
    c.left = -half;
    c.right = half;
    c.top = half;
    c.bottom = -half;
    c.updateProjectionMatrix();
  }

  private setMode(m: Mode) {
    this.mode = m;
    const play = m !== 'diorama';
    this.sky.setVisible(play);
    this.scene.fog = play ? this.sky.fog : null;
    this.water.uniforms.uFade.value = play ? 0 : 1;
    this.water.uniforms.uFadeRadius.value = 82;
    this.water.uniforms.uFogNear.value = play ? 70 : 9999;
    this.water.uniforms.uFogFar.value = play ? 330 : 10000;
    this.props.far.visible = play;
    this.props.boat.visible = play;
    this.sky.setClouds(play);
    if (this.labels) this.labels.showAll = play;
    this.setShadowBox(play ? 26 : 48);
    this.dirty = true;
  }

  /** Enters the full-screen adventure. `overlay` is the page's game layer. */
  enter(overlay: HTMLElement) {
    if (!this.overlay) {
      this.overlay = overlay;
      this.stage = overlay.querySelector<HTMLElement>('.game-stage')!;
      this.labels = new Labels(this.stage);
      this.hud = new Hud(overlay, {
        map: () => this.toggleMap(),
        exit: () => this.host.requestExit(),
        interact: () => this.input.press('interact'),
        jump: () => this.input.press('jump'),
        resume: () => this.hud.showPanel(null),
        travel: (id) => this.travel(id),
        fullscreen: () => this.toggleFullscreen(),
        dayNight: () => {
          this.dayOverride = !this.dayOverride;
          this.syncProgress();
          sound.setNight(!this.dayOverride);
          this.hud.showPanel(null);
        },
        isDay: () => this.dayOverride,
      });
      this.input = new Input(this.stage, this.hud.joyBase, this.hud.joyKnob);
      this.input.onTap = (x, y) => this.onTap(x, y);
      this.input.onHover = (x, y) => this.onHover(x, y);
      this.input.attach();
      for (const a of this.landmarks.anchors) {
        if (a.kind === 'zone') this.labels.add(`zone-${a.id}`, zoneLabel(a.zone!, progress.has(a.zone!)), 'place', () => a.pos.clone().setY(a.pos.y + a.labelY), 44);
        if (a.kind === 'globe') this.labels.add('globe', '<span class="lbl-ic">🌎</span>Donuts Around the World', 'place small', () => a.pos.clone().setY(a.pos.y + a.labelY), 22);
      }
      this.syncFolkLabels();
      this.hud.sync();
    }
    this.stage!.prepend(this.canvas);
    this.observe(this.stage!);
    this.hud.root.classList.remove('cinema');
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.hud.setHint(coarse);
    this.input.usedTouch ||= coarse;
    this.hintT = 9;
    // restore where you were
    const saved = get<V2 | null>('ddi-island-pos', null);
    if (saved && walkable(saved.x, saved.z) && !blocked(saved.x, saved.z, 0.4) && groundHeight(saved.x, saved.z) > 0.05) this.ctl.place(saved.x, saved.z, this.ctl.heading);
    else this.ctl.place(SPAWN.x, SPAWN.z, Math.PI);
    this.camYaw = 0;
    this.setMode('play');
    this.camFrom = { pos: this.camPos.clone(), look: this.camLook.clone(), t: 0, dur: this.reduced ? 0.01 : 1.6 };
    this.input.enabled = true;
    this.input.reset();
    this.paused = false;
    sound.unlock();
    sound.startAmbience();
    sound.setNight(this.sky.isNight);
    if (!progress.state.walked) {
      this.guideBubbleT = 7;
      this.guideTip = 0;
    }
    requestAnimationFrame(() => this.stage?.focus({ preventScroll: true }));
    this.start();
  }

  /** Back to the page: the canvas returns to the hero as a diorama. */
  leave() {
    if (this.mode === 'diorama') return;
    save('ddi-island-pos', { x: this.ctl.pos.x, z: this.ctl.pos.z });
    this.input.enabled = false;
    this.input.reset();
    this.hud.showPanel(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    sound.stopAmbience();
    this.cine = null;
    this.fireworks.active = 0;
    if (this.heroEl) {
      this.heroEl.prepend(this.canvas);
      this.observe(this.heroEl);
    }
    this.setMode('diorama');
    this.camFrom = null;
    this.avatar.speed01 = 0;
  }

  /** The page opened/closed a dialog on top of the island. */
  setPaused(p: boolean) {
    this.paused = p;
    if (this.input) {
      this.input.enabled = !p && this.mode === 'play';
      this.input.reset();
    }
    if (!p && this.mode === 'cinematic' && this.cine && this.cine.fired.has('letter')) this.endFinale();
    if (!p) requestAnimationFrame(() => this.stage?.focus({ preventScroll: true }));
  }

  /** Walk to a destination (used by the quest journal buttons on the page). */
  travelTo(id: string) {
    if (this.mode === 'play') this.travel(id);
  }

  /** Messages or the reveal state changed on the page. */
  refresh() {
    this.syncFolk();
    this.syncProgress();
  }

  /* ───────── loop ───────── */

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (document.hidden) return;
      if (this.mode === 'diorama') {
        if (!this.heroVisible || this.paused) return;
        if (this.reduced && !this.dirty && !this.orbitDrag) return;
      } else if (this.paused && ++this.skip % 3) return; // a dialog covers the island: draw less often
      this.dirty = false;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.mode !== 'diorama') this.governor.tick(dt);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private update(dt: number) {
    const frozen = this.reduced && this.mode === 'diorama';
    this.time += frozen ? 0 : dt;
    const t = this.time;
    const play = this.mode === 'play';
    if (play && !this.paused) this.updatePlayer(dt);
    else if (this.mode === 'diorama') this.avatar.speed01 = 0;

    // world
    this.sky.update(dt, t, this.camera);
    this.water.uniforms.uTime.value = t;
    this.water.uniforms.uFogColor.value.copy(this.sky.fog.color);
    this.props.update(dt, t, this.sky.nightAmount);
    this.landmarks.update(dt, t, this.sky.nightAmount, this.pointScale);
    this.sprinkles.update(dt, t);
    this.bottles.update(dt, t);
    this.glow.update(dt, t);
    this.puffs.update(dt, t);
    this.fireworks.update(dt);
    this.skyLanterns.update(dt, t);
    for (const f of this.folk.values()) f.npc.update(dt, t, this.ctl.pos);

    // avatar
    this.avatar.root.position.copy(this.ctl.pos);
    if (this.mode === 'diorama') {
      this.avatar.root.rotation.y += (Math.atan2(this.camera.position.x - this.ctl.pos.x, this.camera.position.z - this.ctl.pos.z) - this.avatar.root.rotation.y) * 0.05;
      if (Math.sin(t * 0.35) > 0.97) this.avatar.wave(1.5);
    } else this.avatar.root.rotation.y = this.ctl.heading;
    this.avatar.airborne = !this.ctl.grounded;
    this.avatar.update(dt, t, Math.max(0, this.ctl.pos.y - groundHeight(this.ctl.pos.x, this.ctl.pos.z)));

    // sun follows the action so shadows stay crisp
    const focus = this.mode === 'diorama' ? new THREE.Vector3(0, 0, 0) : this.ctl.pos;
    this.sky.sun.target.position.copy(focus);
    this.sky.sun.position.copy(focus).addScaledVector(this.sky.sunDir, 90);

    this.updateCamera(dt);
    if (this.mode !== 'diorama') {
      this.labels.project(this.camera, this.ctl.pos, this.stage!.clientWidth, this.stage!.clientHeight);
      if (this.cine) this.updateFinale(dt);
    }
  }

  /* ───────── player ───────── */

  private updatePlayer(dt: number) {
    const inp = this.input;
    inp.pollGamepad();
    if (inp.consume('pause')) {
      this.hud.showPanel(this.hud.panelOpen ? null : 'pause');
      inp.reset();
    }
    if (inp.consume('map')) this.toggleMap();
    if (this.hud.panelOpen) {
      this.avatar.speed01 = 0;
      return;
    }
    this.camYaw += inp.yawDelta;
    inp.yawDelta = 0;
    const a = inp.axis();
    const cos = Math.cos(this.camYaw);
    const sin = Math.sin(this.camYaw);
    const wx = a.x * cos + a.z * sin;
    const wz = -a.x * sin + a.z * cos;
    let jump = inp.consume('jump');
    let interact = inp.consume('interact');
    if (inp.consume('action')) {
      if (this.target) interact = true;
      else jump = true;
    }
    // Donuts are soft obstacles
    this.ctl.dynamic = [...this.folk.values()].map((f) => ({ x: f.npc.pos.x, z: f.npc.pos.z, r: 0.5 }));
    const ev = this.ctl.update(dt, { x: wx, z: wz, run: inp.running, jump });
    this.avatar.speed01 = this.ctl.speed01;
    if (Math.hypot(wx, wz) > 0.2 && !progress.state.walked) progress.flag('walked');
    if (ev.jumped) {
      sound.jump();
      this.avatar.bounce(-0.55);
      progress.jump();
      this.puffs.emit({ count: 6, pos: this.ctl.pos, color: '#fff3df', speed: 1.4, size: 0.5, life: 0.5, gravity: 0, shape: 'ring' });
    }
    if (ev.landed > 2) {
      sound.land(ev.landed);
      this.avatar.bounce(Math.min(0.9, ev.landed * 0.08));
      this.puffs.emit({ count: 8, pos: this.ctl.pos, color: groundHeight(this.ctl.pos.x, this.ctl.pos.z) < 0 ? '#e6fbff' : '#fbecd2', speed: 2.2, size: 0.55, life: 0.6, gravity: 1, shape: 'ring' });
    }
    if (ev.step) {
      sound.step(ev.wading);
      if (ev.wading) this.puffs.emit({ count: 4, pos: this.ctl.pos, color: '#effcff', speed: 1.6, up: 1.2, size: 0.35, life: 0.45, gravity: 6, shape: 'ring' });
      else if (this.ctl.speed01 > 0.7) this.puffs.emit({ count: 2, pos: this.ctl.pos, color: '#fbecd2', speed: 0.8, size: 0.45, life: 0.5, gravity: -0.5 });
    }
    if (ev.wading && !progress.state.splashed) progress.flag('splashed');
    if (ev.fell) {
      sound.splash();
      this.puffs.emit({ count: 26, pos: this.ctl.pos.clone().setY(0.1), color: ['#ffffff', '#d9f7ff'], speed: 4.5, up: 3, size: 0.5, life: 0.9, gravity: 9, shape: 'cone', spread: 1.2 });
      this.host.toast('Splash! Too deep there. Back to the beach you go.');
    }
    if (ev.arrived && this.pendingAct) {
      const id = this.pendingAct;
      this.pendingAct = null;
      this.computeTarget();
      if (this.target && this.target.id === id) this.target.act();
    }

    // collectibles
    const got = this.sprinkles.check(this.ctl.pos);
    if (got.length) {
      this.comboT = 1.6;
      for (const i of got) {
        this.combo++;
        progress.sprinkle(i);
        sound.sprinkle(this.combo - 1);
        this.glow.emit({ count: 18, pos: this.sprinkles.position(i), color: ['#ff9ad5', '#9fe6ff', '#ffe08a', '#c9b8ff'], speed: 3.2, size: 0.32, life: 0.8, gravity: 2, twinkle: 0.6 });
      }
      this.hud.pulse('sprinkles');
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.bottles.check(this.ctl.pos)) this.openBottle();
    if (!progress.state.golden && Math.hypot(this.ctl.pos.x - GOLDEN.x, this.ctl.pos.z - GOLDEN.z) < 1.5) this.collectGolden();

    // what can we interact with?
    this.computeTarget();
    if (interact && this.target) this.target.act();
    const touch = inp.usedTouch;
    this.hud.setPrompt(this.target ? this.target.label : null, touch ? 'TAP' : inp.usedPad ? 'A' : 'E', this.target?.locked);
    this.hud.root.classList.toggle('touch', touch);

    // Donut attention + guide bubble
    for (const [id, f] of this.folk) {
      const d = Math.hypot(f.npc.pos.x - this.ctl.pos.x, f.npc.pos.z - this.ctl.pos.z);
      f.npc.attention = d < 3.2;
      if (id === 'guide') {
        if (this.guideBubbleT > 0) {
          this.guideBubbleT -= dt;
          this.labels.bubble('folk-guide', this.guideLine());
        } else this.labels.bubble('folk-guide', d < 3.2 ? this.guideLine() : null);
      } else this.labels.bubble(`folk-${id}`, d < 3.2 && f.message ? `“${f.message.title || 'A little note'}”` : null);
    }

    if (this.hintT > 0) {
      this.hintT -= dt;
      this.hud.root.classList.toggle('show-hint', this.hintT > 0);
    }
    this.saveT += dt;
    if (this.saveT > 3) {
      this.saveT = 0;
      if (this.ctl.grounded && groundHeight(this.ctl.pos.x, this.ctl.pos.z) > 0.05) save('ddi-island-pos', { x: this.ctl.pos.x, z: this.ctl.pos.z });
    }
  }

  private guideLine() {
    if (!this.host.isRevealed()) return 'The Donuts’ messages are sealed until the big reveal. Leave one at the Donut Shop!';
    if (progress.allQuests && !this.finaleSeen) return 'All six lanterns are glowing! Go see what rose from the fountain ✨';
    return GUIDE_TIPS[this.guideTip % GUIDE_TIPS.length];
  }

  private computeTarget() {
    const p = this.ctl.pos;
    let best: Target | null = null;
    const offer = (t: Target) => {
      if (!best || t.dist < best.dist) best = t;
    };
    for (const [id, f] of this.folk) {
      const d = Math.hypot(f.npc.pos.x - p.x, f.npc.pos.z - p.z);
      if (d < 2) {
        offer({
          kind: 'npc',
          id: `npc-${id}`,
          dist: d - 0.5,
          label: id === 'guide' ? 'Talk to Glaze' : `Read ${f.npc.spec.name}’s note`,
          act: () => this.talk(id),
        });
      }
    }
    for (const l of LANDMARKS) {
      const d = Math.hypot(l.entry.x - p.x, l.entry.z - p.z);
      if (d < 2.8) {
        const z = zoneById(l.id);
        offer({ kind: 'zone', id: l.id, dist: d, label: `${progress.has(l.id) ? 'Visit' : 'Discover'} ${z.name}`, act: () => this.visit(l.id) });
      }
    }
    const gd = Math.hypot(GLOBE.x - p.x, GLOBE.z - p.z);
    if (gd < 2.4) offer({ kind: 'globe', id: 'globe', dist: gd, label: 'Spin the globe: Donuts Around the World', act: () => this.host.openAttraction('worldmap') });
    const fd = Math.hypot(PLAZA.x - p.x, PLAZA.z - p.z);
    if (fd < 5) {
      const ready = progress.allQuests;
      offer({
        kind: 'finale',
        id: 'finale',
        dist: fd + 0.6,
        label: ready ? 'Open the grand finale 🎁' : `Light ${6 - progress.questsDone} more lantern${6 - progress.questsDone === 1 ? '' : 's'} to open the finale`,
        locked: !ready,
        act: () => this.finale(),
      });
    }
    this.target = best;
  }

  /* ───────── interactions ───────── */

  private visit(id: Category) {
    const isNew = progress.visit(id);
    if (isNew) {
      const z = zoneById(id);
      sound.quest();
      this.avatar.cheer();
      this.glow.emit({ count: 60, pos: this.ctl.pos.clone().setY(this.ctl.pos.y + 1.2), color: [z.accent, '#ffffff', '#ffe08a'], speed: 5, size: 0.4, life: 1.2, gravity: 3, twinkle: 0.5 });
      this.host.toast(`Quest complete! +100 XP · ${z.treasure} ${z.treasureName}`);
      this.hud.pulse('quest');
      this.input.reset();
      setTimeout(() => this.host.openZone(id), this.reduced ? 0 : 1100);
    } else this.host.openZone(id);
  }

  private talk(id: string) {
    const f = this.folk.get(id);
    if (!f) return;
    sound.babble(hashString(id) % 97, id === 'guide' ? 12 : 9);
    if (id === 'guide') {
      this.guideTip++;
      this.guideBubbleT = 6;
      return;
    }
    if (!f.message) return;
    if (progress.meet(f.message.id)) {
      this.glow.emit({ count: 22, pos: f.npc.pos.clone().setY(f.npc.pos.y + 1.4), color: ['#ff9ad5', '#ffffff'], speed: 2.5, size: 0.35, life: 0.9, gravity: 1.5 });
      this.host.toast(`You met ${f.npc.spec.name}! +25 XP`);
    }
    f.npc.talking = true;
    setTimeout(() => (f.npc.talking = false), 2500);
    this.host.openMessage(f.message, 'npc');
  }

  private openBottle() {
    sound.bottle();
    this.glow.emit({ count: 26, pos: this.ctl.pos.clone().setY(this.ctl.pos.y + 0.8), color: ['#fff6c9', '#bdf0e6'], speed: 2.6, size: 0.35, life: 0.8, gravity: 1 });
    const pool = this.host.isRevealed() ? this.host.getMessages() : [];
    const unread = pool.filter((m) => !progress.state.bottles.includes(m.id));
    const pick = (unread.length ? unread : pool)[Math.floor(Math.random() * (unread.length || pool.length))];
    if (pick) {
      progress.bottle(pick.id);
      this.host.openMessage(pick, 'bottle');
    } else {
      const tip = this.host.isRevealed()
        ? 'This bottle is waiting for its first note. Leave one for Dani and it might wash up here!'
        : 'Shh… the Donuts’ messages are sealed until the big reveal. Leave one at the Donut Shop, and check back on the big day!';
      progress.bottle('tip');
      this.host.openMessage(
        { id: 'tip', event_id: '', category: 'note', author: 'Glaze, the island guide', title: 'A note from the island', body: tip, link: null, visibility: 'public', status: 'approved' },
        'bottle',
      );
    }
  }

  private collectGolden() {
    progress.flag('golden');
    this.landmarks.setGolden(false);
    sound.golden();
    this.avatar.cheer(2);
    this.glow.emit({ count: 120, pos: new THREE.Vector3(GOLDEN.x, this.ctl.pos.y + 1.5, GOLDEN.z), color: ['#ffd970', '#fff4c9', '#ffffff'], speed: 6, size: 0.5, life: 1.6, gravity: 2, twinkle: 0.7 });
    this.host.toast('You found the golden donut! +150 XP 🏆');
  }

  private travel(id: string) {
    if (id === 'worldmap') return this.walkTo(GLOBE, 'globe');
    if (id === 'finale') return this.walkTo({ x: PLAZA.x, z: PLAZA.z + 3.6 }, 'finale');
    const l = landmarkById(id as Category);
    if (l) this.walkTo(l.entry, l.id);
  }

  private walkTo(p: V2, actId: string | null) {
    const path = findPath({ x: this.ctl.pos.x, z: this.ctl.pos.z }, p);
    if (!path) {
      sound.error();
      this.host.toast('Hmm, there’s no path there. Maybe try jumping?');
      return;
    }
    this.ctl.path = path;
    this.pendingAct = actId;
    if (!path.length && actId) {
      this.computeTarget();
      if (this.target?.id === actId) this.target.act();
    }
  }

  private pick(x: number, y: number) {
    const rect = this.stage!.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const proxies = [...this.landmarks.proxies, ...[...this.folk.values()].map((f) => f.proxy)];
    const hit = this.raycaster.intersectObjects(proxies, false)[0];
    if (hit) return { anchor: hit.object.userData.anchor as string | undefined, folk: hit.object.userData.folk as string | undefined, point: hit.point };
    const terrain = this.scene.getObjectByName('terrain')!;
    const g = this.raycaster.intersectObject(terrain, false)[0];
    return g ? { point: g.point } : null;
  }

  private onTap(x: number, y: number) {
    if (this.paused || this.mode !== 'play' || this.hud.panelOpen) return;
    const hit = this.pick(x, y);
    if (!hit) return;
    if (hit.folk) {
      const f = this.folk.get(hit.folk);
      if (f) {
        const d = Math.hypot(f.npc.pos.x - this.ctl.pos.x, f.npc.pos.z - this.ctl.pos.z);
        if (d < 2) this.talk(hit.folk);
        else this.walkTo({ x: f.npc.pos.x + 0.9, z: f.npc.pos.z + 0.9 }, `npc-${hit.folk}`);
      }
      return;
    }
    if (hit.anchor) {
      if (hit.anchor === 'globe') return this.walkTo(GLOBE, 'globe');
      if (hit.anchor === 'finale') return this.walkTo({ x: PLAZA.x, z: PLAZA.z + 3.6 }, 'finale');
      const l = LANDMARKS.find((ll) => ll.id === hit.anchor);
      if (l) return this.walkTo(l.entry, l.id);
    }
    const p = hit.point;
    if (walkable(p.x, p.z)) {
      this.walkTo({ x: p.x, z: p.z }, null);
      this.puffs.emit({ count: 8, pos: new THREE.Vector3(p.x, groundHeight(p.x, p.z) + 0.05, p.z), color: '#ffffff', speed: 1.5, size: 0.35, life: 0.5, gravity: 0, shape: 'ring' });
    }
  }

  private onHover(x: number, y: number) {
    const now = performance.now();
    if (now - this.hoverT < 80 || this.mode !== 'play') return;
    this.hoverT = now;
    const hit = this.pick(x, y);
    this.stage!.style.cursor = hit && (hit.anchor || hit.folk) ? 'pointer' : '';
  }

  private toggleMap() {
    if (this.hud.panelOpen === 'map') return this.hud.showPanel(null);
    this.hud.showPanel(
      'map',
      islandMapHTML({ visited: progress.collection, player: { x: this.ctl.pos.x, z: this.ctl.pos.z, heading: this.ctl.heading }, goldenFound: progress.state.golden }),
    );
  }

  private toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void this.overlay?.requestFullscreen?.().catch(() => undefined);
  }

  /* ───────── the grand finale ───────── */

  private finale() {
    if (!this.host.canFinale()) {
      if (!progress.allQuests) {
        sound.error();
        this.host.toast(`${6 - progress.questsDone} more quest${6 - progress.questsDone === 1 ? '' : 's'} to go. Follow the paths from the fountain!`);
      } else this.host.openAttraction('finale');
      return;
    }
    this.mode = 'cinematic';
    this.input.enabled = false;
    this.input.reset();
    this.hud.root.classList.add('cinema');
    this.hud.setPrompt(null);
    this.labels.showAll = false;
    this.cine = { t: 0, fired: new Set() };
    this.camFrom = { pos: this.camera.position.clone(), look: this.camLook.clone(), t: 0, dur: this.reduced ? 0.01 : 2.6 };
    sound.finale();
    this.dayOverride = false;
    this.sky.setTarget(1, 1);
    sound.setNight(true);
  }

  private updateFinale(dt: number) {
    const c = this.cine!;
    c.t += dt;
    const once = (k: string, at: number, fn: () => void) => {
      if (c.t >= at && !c.fired.has(k)) {
        c.fired.add(k);
        fn();
      }
    };
    once('burst', 1.4, () => {
      const p = this.landmarks.gift.position.clone().setY(this.landmarks.gift.position.y + 1.6);
      this.landmarks.popGift();
      this.glow.emit({ count: 160, pos: p, color: ['#ff9ad5', '#ffe08a', '#9fe6ff', '#ffffff', '#c9b8ff'], speed: 9, size: 0.7, life: 2, gravity: 4, twinkle: 0.6 });
      this.glow.emit({ count: 40, pos: p, color: ['#ffffff', '#ffe08a'], speed: 4, up: 9, size: 1.2, life: 1.6, gravity: 2, shape: 'cone', spread: 0.5 });
      this.avatar.cheer(3);
      sound.sparkle();
    });
    once('fireworks', 2.2, () => {
      this.fireworks.start(this.reduced ? 4 : 18);
      const authors = new Set(this.host.getMessages().map((m) => m.author.trim().toLowerCase()));
      this.skyLanterns.release(authors.size * 3);
    });
    once('letter', 7.5, () => {
      progress.flag('finale');
      this.finaleSeen = true;
      this.host.showFinaleLetter();
    });
  }

  private endFinale() {
    this.mode = 'play';
    this.cine = null;
    this.hud.root.classList.remove('cinema');
    this.labels.showAll = true;
    this.input.enabled = !this.paused;
    this.camFrom = { pos: this.camera.position.clone(), look: this.camLook.clone(), t: 0, dur: 1.4 };
  }

  /* ───────── camera ───────── */

  private updateCamera(dt: number) {
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    const aspect = this.camera.aspect;
    if (this.mode === 'diorama') {
      if (!this.orbitDrag && !this.reduced) this.orbitYaw += dt * 0.045;
      // fit the island (plus the secret islet) snugly in whatever box the hero gives us
      this.camera.fov = 30;
      const vfov = THREE.MathUtils.degToRad(this.camera.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const r = (40 / Math.sin(Math.min(vfov, hfov) / 2)) * 0.92;
      const pitch = 0.58;
      desiredPos.set(5 + Math.sin(this.orbitYaw) * r * Math.cos(pitch), r * Math.sin(pitch), Math.cos(this.orbitYaw) * r * Math.cos(pitch));
      desiredLook.set(5, -1.5, 0);
    } else if (this.mode === 'cinematic') {
      desiredPos.set(PLAZA.x + 2, 9.5, PLAZA.z + 27);
      desiredLook.set(PLAZA.x, 7, PLAZA.z - 24);
      this.camera.fov = 48;
    } else {
      const zoom = (this.input?.zoom ?? 1) * (aspect < 0.8 ? 1.35 : aspect < 1.2 ? 1.12 : 1);
      const d = 11.5 * zoom;
      const hgt = 8.8 * zoom;
      const p = this.ctl.pos;
      desiredPos.set(p.x + Math.sin(this.camYaw) * d, p.y + hgt, p.z + Math.cos(this.camYaw) * d);
      desiredLook.set(p.x - Math.sin(this.camYaw) * 1.6 + this.ctl.vel.x * 0.18, p.y + 0.9, p.z - Math.cos(this.camYaw) * 1.6 + this.ctl.vel.z * 0.18);
      this.camera.fov = 42;
    }
    if (this.camFrom) {
      const cf = this.camFrom;
      cf.t += dt / cf.dur;
      const e = ease(Math.min(1, cf.t));
      this.camPos.lerpVectors(cf.pos, desiredPos, e);
      this.camLook.lerpVectors(cf.look, desiredLook, e);
      if (cf.t >= 1) this.camFrom = null;
    } else {
      const k = this.mode === 'diorama' ? 1 : 1 - Math.exp(-dt * 7);
      this.camPos.lerp(desiredPos, k);
      this.camLook.lerp(desiredLook, k);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.updateProjectionMatrix();
  }

  /* ───────── progress + Donuts ───────── */

  private syncProgress(instant = false) {
    if (!this.landmarks) return;
    const done = progress.collection;
    this.landmarks.setLanterns(done, instant);
    this.landmarks.setGift(progress.allQuests, instant);
    this.sky.setTarget(done.length / 6, progress.state.finale && !this.dayOverride ? 1 : 0, instant);
    if (this.hud) this.hud.sync();
    if (this.labels) for (const id of ZONES.map((z) => z.id)) this.labels.update(`zone-${id}`, zoneLabel(id, done.includes(id)));
  }

  private addGuide() {
    const spec: FolkSpec = { id: 'guide', name: 'Glaze', frosting: '#c9b8ff', sprinkles: 'stars', home: { x: SPAWN.x + 3, z: SPAWN.z + 1.5 }, guide: true };
    this.spawnFolk(spec, null);
  }

  private spawnFolk(spec: FolkSpec, message: Message | null) {
    const npc = new DonutFolk(spec);
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.8, 8), new THREE.MeshBasicMaterial());
    proxy.visible = false;
    proxy.position.y = 0.9;
    proxy.userData.folk = spec.id;
    npc.root.add(proxy);
    this.scene.add(npc.root);
    this.folk.set(spec.id, { npc, message, proxy });
  }

  /** One Donut per unique author (up to 16), dressed in the frosting they picked. */
  private syncFolk() {
    if (!this.landmarks) return;
    const msgs = this.host.isRevealed() ? this.host.getMessages() : [];
    const seen = new Set<string>();
    const picks: Message[] = [];
    for (const m of msgs) {
      const key = m.author.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push(m);
      if (picks.length >= 16) break;
    }
    const keep = new Set(picks.map((m) => m.id));
    for (const [id, f] of this.folk) {
      if (id === 'guide' || keep.has(id)) continue;
      this.scene.remove(f.npc.root);
      this.folk.delete(id);
    }
    const frostKeys = Object.keys(FROSTINGS) as (keyof typeof FROSTINGS)[];
    const sprinkleKeys: SprinkleStyle[] = ['rainbow', 'stars', 'hearts', 'rainbow'];
    picks.forEach((m) => {
      if (this.folk.has(m.id)) return;
      const h = hashString(m.author + m.id);
      const frosting = FROSTINGS[m.meta?.frosting ?? frostKeys[h % frostKeys.length]].color;
      const sprinkles = m.meta?.sprinkles ?? sprinkleKeys[(h >> 3) % sprinkleKeys.length];
      const l = landmarkById(m.category) ?? LANDMARKS[0];
      let home: V2 = { x: l.entry.x, z: l.entry.z };
      for (let i = 0; i < 20; i++) {
        const a = ((h >> (i % 16)) % 360) * (Math.PI / 180) + i;
        const r = 2.5 + ((h >> 5) % 30) / 10 + i * 0.2;
        const x = l.entry.x + Math.cos(a) * r;
        const z = l.entry.z + Math.sin(a) * r;
        if (walkable(x, z) && groundHeight(x, z) > 0.05 && !blocked(x, z, 0.6)) {
          home = { x, z };
          break;
        }
      }
      this.spawnFolk({ id: m.id, name: m.author || 'Anonymous Donut', frosting, sprinkles, home }, m);
    });
    this.syncFolkLabels();
  }

  private syncFolkLabels() {
    if (!this.labels) return;
    this.labels.clear('folk-');
    for (const [id, f] of this.folk) {
      const name = id === 'guide' ? 'Glaze · island guide' : f.npc.spec.name;
      const sample = f.message?.example ? '<small>sample</small>' : '';
      this.labels.add(`folk-${id}`, `${esc(name)}${sample}`, id === 'guide' ? 'folk guide' : 'folk', () => f.npc.pos.clone().setY(f.npc.pos.y + 1.55), id === 'guide' ? 14 : 11);
    }
  }
}

export async function createIsland(host: IslandHost) {
  const game = new IslandGame(host);
  await game.build();
  return game;
}

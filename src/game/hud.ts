/* The in-game HUD (HTML over the canvas) and the floating world labels / speech bubbles. */
import * as THREE from 'three';
import { ZONES } from '../data/catalog';
import { progress, SPRINKLE_TOTAL } from '../lib/progress';
import { sound } from '../lib/sound';
import { ICONS } from '../ui/icons';
import { esc } from '../ui/dom';
import { islandMapHTML } from '../ui/islandMap';
import type { Category } from '../data/types';

export interface HudHandlers {
  map(): void;
  exit(): void;
  interact(): void;
  jump(): void;
  resume(): void;
  travel(target: string): void;
  fullscreen(): void;
  dayNight(): void;
  isDay(): boolean;
}

export class Hud {
  readonly root: HTMLElement;
  readonly joyBase: HTMLElement;
  readonly joyKnob: HTMLElement;
  private prompt: HTMLButtonElement;
  private promptText: HTMLElement;
  private promptKey: HTMLElement;
  private treasures: HTMLElement;
  private rank: HTMLElement;
  private bar: HTMLElement;
  private xpNum: HTMLElement;
  private sprinkles: HTMLElement;
  private panel: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private hint: HTMLElement;
  panelOpen: 'map' | 'pause' | null = null;

  constructor(
    host: HTMLElement,
    private h: HudHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-card hud-quest" aria-label="Quest progress">
          <div class="hud-treasures"></div>
          <div class="hud-xp">
            <span class="hud-rank"></span>
            <span class="hud-bar" aria-hidden="true"><i></i></span>
            <span class="hud-xpnum"></span>
          </div>
        </div>
        <div class="hud-card hud-sprinkles" aria-label="Sprinkles collected"></div>
        <div class="hud-buttons">
          <button type="button" class="hud-btn" data-hud="map" aria-label="Island map (M)" title="Island map (M)">${ICONS.map}</button>
          <button type="button" class="hud-btn" data-hud="sound" aria-label="Sound" title="Sound"></button>
          <button type="button" class="hud-btn hud-full" data-hud="full" aria-label="Fullscreen" title="Fullscreen">${ICONS.expand}</button>
          <button type="button" class="hud-btn" data-hud="pause" aria-label="Pause menu (Esc)" title="Pause (Esc)">${ICONS.pause}</button>
        </div>
      </div>
      <p class="hud-hint"></p>
      <button type="button" class="hud-prompt" hidden><kbd></kbd><span></span></button>
      <div class="hud-joy" aria-hidden="true"><div class="hud-joy-knob"></div></div>
      <div class="hud-touch">
        <button type="button" class="hud-act" data-hud="interact" aria-label="Interact">${ICONS.sparkle}</button>
        <button type="button" class="hud-act jump" data-hud="jump" aria-label="Jump"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg></button>
      </div>
      <div class="hud-panel" hidden role="dialog" aria-modal="false"></div>`;
    host.append(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.joyBase = q('.hud-joy');
    this.joyKnob = q('.hud-joy-knob');
    this.prompt = q('.hud-prompt');
    this.promptText = this.prompt.querySelector('span')!;
    this.promptKey = this.prompt.querySelector('kbd')!;
    this.treasures = q('.hud-treasures');
    this.rank = q('.hud-rank');
    this.bar = q('.hud-bar i');
    this.xpNum = q('.hud-xpnum');
    this.sprinkles = q('.hud-sprinkles');
    this.panel = q('.hud-panel');
    this.soundBtn = q('[data-hud="sound"]');
    this.hint = q('.hud-hint');
    if (!document.fullscreenEnabled) q('.hud-full').hidden = true;

    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hud],[data-map-zone],[data-panel-act]');
      if (!b) return;
      sound.click();
      const act = b.dataset.hud;
      if (act === 'map') this.h.map();
      else if (act === 'sound') sound.toggle();
      else if (act === 'full') this.h.fullscreen();
      else if (act === 'pause') this.showPanel(this.panelOpen === 'pause' ? null : 'pause');
      else if (act === 'interact') this.h.interact();
      else if (act === 'jump') this.h.jump();
      else if (b.dataset.mapZone) {
        this.showPanel(null);
        this.h.travel(b.dataset.mapZone);
      } else if (b.dataset.panelAct === 'resume') this.h.resume();
      else if (b.dataset.panelAct === 'map') this.h.map();
      else if (b.dataset.panelAct === 'exit') this.h.exit();
      else if (b.dataset.panelAct === 'daynight') this.h.dayNight();
      else if (b.dataset.panelAct === 'reset') {
        if (confirm('Start your island adventure over? Your quests, sprinkles and trophies on this device will be reset.')) {
          progress.reset();
          location.reload();
        }
      }
    });
    this.prompt.addEventListener('click', () => this.h.interact());
    const syncSound = (on: boolean) => {
      this.soundBtn.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
      this.soundBtn.setAttribute('aria-pressed', String(on));
      this.soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    };
    syncSound(sound.enabled);
    sound.onChange(syncSound);
    this.setHint(false);
  }

  setHint(touch: boolean, pad = false) {
    this.hint.innerHTML = pad
      ? '<b>Stick</b> move · <b>A</b> talk / enter · <b>X</b> jump · <b>Y</b> map'
      : touch
        ? 'Drag the left side to walk · tap the ground or a place to go there'
        : '<kbd>W A S D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> talk / enter · <kbd>M</kbd> map';
    this.root.classList.toggle('touch', touch);
  }

  sync() {
    const done = progress.collection;
    this.treasures.innerHTML = ZONES.map(
      (z) => `<span class="hud-t ${done.includes(z.id) ? 'on' : ''}" title="${esc(z.name)}: ${done.includes(z.id) ? esc(z.treasureName) : 'not found yet'}">${done.includes(z.id) ? z.treasure : '?'}</span>`,
    ).join('') + `<span class="hud-count">${done.length}/6</span>`;
    const r = progress.rank;
    this.rank.textContent = `Lv ${r.level} · ${r.name}`;
    this.bar.style.width = `${Math.round(r.pct * 100)}%`;
    this.xpNum.textContent = `${progress.xp} XP`;
    this.sprinkles.innerHTML = `<span class="hud-sprinkle-ic" aria-hidden="true"></span><b>${progress.state.sprinkles.length}</b>/${SPRINKLE_TOTAL}`;
  }

  pulse(el: 'sprinkles' | 'quest') {
    const node = el === 'sprinkles' ? this.sprinkles : this.treasures.parentElement!;
    node.classList.remove('pulse');
    void node.offsetWidth;
    node.classList.add('pulse');
  }

  setPrompt(text: string | null, key = 'E', locked = false) {
    if (!text) {
      this.prompt.hidden = true;
      this.root.classList.remove('can-act');
      return;
    }
    this.prompt.hidden = false;
    this.root.classList.add('can-act');
    this.promptKey.textContent = key;
    this.promptText.textContent = text;
    this.prompt.classList.toggle('locked', locked);
  }

  showPanel(which: 'map' | 'pause' | null, mapHTML = '') {
    this.panelOpen = which;
    this.panel.hidden = !which;
    this.root.classList.toggle('panel-open', !!which);
    if (which === 'map') {
      this.panel.innerHTML = `<div class="hud-panel-card map"><header><h2>Island map</h2><button type="button" class="hud-btn" data-panel-act="resume" aria-label="Close map">${ICONS.close}</button></header>
        <p class="hud-panel-sub">Tap a place to walk there. Lanterns around the fountain light up as you finish each quest.</p>${mapHTML}</div>`;
      this.panel.querySelector<HTMLElement>('[data-map-zone]')?.focus();
    } else if (which === 'pause') {
      const r = progress.rank;
      this.panel.innerHTML = `<div class="hud-panel-card pause"><header><h2>Paused</h2></header>
        <p class="hud-panel-sub">${progress.questsDone}/6 quests · ${progress.state.sprinkles.length}/${SPRINKLE_TOTAL} sprinkles · ${progress.xp} XP · ${esc(r.name)}</p>
        <div class="hud-menu">
          <button type="button" class="btn" data-panel-act="resume">${ICONS.play} Keep exploring</button>
          <button type="button" class="btn light" data-panel-act="map">${ICONS.map} Island map</button>
          ${progress.state.finale ? `<button type="button" class="btn light" data-panel-act="daynight">${this.h.isDay() ? '🌙 Starry night' : '☀️ Back to daytime'}</button>` : ''}
          <button type="button" class="btn light" data-panel-act="exit">${ICONS.back} Back to the page</button>
          <button type="button" class="linkbtn" data-panel-act="reset">Start the adventure over</button>
        </div>
        <div class="hud-keys">
          <p><kbd>WASD</kbd>/<kbd>↑←↓→</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> talk &amp; enter · <kbd>M</kbd> map · <kbd>Esc</kbd> pause</p>
          <p>Touch: drag the left side of the screen to walk, tap anywhere to go there. Controllers work too.</p>
        </div></div>`;
      this.panel.querySelector<HTMLElement>('[data-panel-act="resume"]')?.focus();
    } else this.panel.innerHTML = '';
  }

  zoneDone(id: Category) {
    return progress.collection.includes(id);
  }
}

/* ───────── floating labels ───────── */

interface Label {
  el: HTMLElement;
  bubble: HTMLElement | null;
  pos: () => THREE.Vector3;
  maxDist: number;
  always?: boolean;
}

export class Labels {
  readonly layer: HTMLElement;
  private items = new Map<string, Label>();
  private v = new THREE.Vector3();
  showAll = true;

  constructor(host: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'labels';
    this.layer.setAttribute('aria-hidden', 'true');
    host.append(this.layer);
  }

  add(id: string, markup: string, cls: string, pos: () => THREE.Vector3, maxDist: number) {
    this.remove(id);
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    el.innerHTML = `<div class="lbl-in">${markup}</div>`;
    this.layer.append(el);
    this.items.set(id, { el, bubble: null, pos, maxDist });
  }

  update(id: string, markup: string) {
    const it = this.items.get(id);
    if (it) it.el.querySelector('.lbl-in')!.innerHTML = markup;
  }

  remove(id: string) {
    this.items.get(id)?.el.remove();
    this.items.delete(id);
  }

  clear(prefix: string) {
    for (const id of [...this.items.keys()]) if (id.startsWith(prefix)) this.remove(id);
  }

  bubble(id: string, text: string | null) {
    const it = this.items.get(id);
    if (!it) return;
    if (!text) {
      it.bubble?.remove();
      it.bubble = null;
      return;
    }
    if (!it.bubble) {
      it.bubble = document.createElement('div');
      it.bubble.className = 'bubble';
      it.el.prepend(it.bubble);
    }
    if (it.bubble.textContent !== text) it.bubble.textContent = text;
  }

  project(camera: THREE.Camera, player: THREE.Vector3, w: number, h: number) {
    for (const [, it] of this.items) {
      const p = it.pos();
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      this.v.copy(p).project(camera);
      const visible = this.showAll && this.v.z < 1 && Math.abs(this.v.x) < 1.15 && Math.abs(this.v.y) < 1.15 && d < it.maxDist;
      if (!visible) {
        if (!it.el.classList.contains('off')) it.el.classList.add('off');
        continue;
      }
      it.el.classList.remove('off');
      let x = (this.v.x * 0.5 + 0.5) * w;
      // keep speech bubbles on screen
      if (it.bubble) x = Math.min(w - 150, Math.max(150, x));
      const y = (-this.v.y * 0.5 + 0.5) * h;
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      it.el.style.opacity = String(Math.max(0.15, Math.min(1, (it.maxDist - d) / (it.maxDist * 0.35))));
    }
  }
}

export const zoneLabel = (id: Category, done: boolean) => {
  const z = ZONES.find((zz) => zz.id === id)!;
  return `<span class="lbl-ic">${z.icon}</span>${esc(z.name)}${done ? '<span class="lbl-check">✓</span>' : ''}`;
};

export { islandMapHTML };

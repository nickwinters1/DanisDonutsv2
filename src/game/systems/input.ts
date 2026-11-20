/* Keyboard, touch joystick, tap/click-to-walk, wheel/pinch zoom and gamepads. */

type Action = 'jump' | 'interact' | 'action' | 'pause' | 'map';

const KEYMAP: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export class Input {
  enabled = false;
  private keys = new Set<string>();
  private edges = new Set<Action>();
  private joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private taps = new Map<number, { x: number; y: number; t: number; moved: boolean; lastX: number }>();
  /** accumulated camera-rotation drag (radians), consumed by the game each frame */
  yawDelta = 0;
  dragging = false;
  private pinch: { d: number } | null = null;
  private padPrev: boolean[] = [];
  private padAxis = { x: 0, y: 0 };
  private padRun = false;
  zoom = 1;
  usedTouch = false;
  usedPad = false;
  onTap: ((x: number, y: number) => void) | null = null;
  onHover: ((x: number, y: number) => void) | null = null;
  private cleanup: (() => void)[] = [];

  constructor(
    private stage: HTMLElement,
    private joyBase: HTMLElement,
    private joyKnob: HTMLElement,
  ) {}

  attach() {
    const on = <K extends keyof WindowEventMap>(t: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => {
      if (!this.enabled || editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      if (KEYMAP[e.code]) {
        this.keys.add(e.code);
        e.preventDefault();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.add('Shift');
      else if (e.code === 'Space' && !onButton) {
        if (!e.repeat) this.edges.add('jump');
        e.preventDefault();
      } else if ((e.code === 'KeyE' || (e.code === 'Enter' && !onButton)) && !e.repeat) {
        this.edges.add('interact');
        e.preventDefault();
      } else if (e.code === 'Escape' && !e.repeat) this.edges.add('pause');
      else if (e.code === 'KeyM' && !e.repeat) this.edges.add('map');
    });
    on(window, 'keyup', (e) => {
      if (KEYMAP[e.code]) this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.delete('Shift');
    });
    on(window, 'blur', () => this.reset());

    on(this.stage, 'pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch') this.usedTouch = true;
      const rect = this.stage.getBoundingClientRect();
      const left = e.clientX - rect.left < rect.width * 0.45;
      if (e.pointerType === 'touch' && left && this.joy.id === -1) {
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        this.joyBase.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
        this.joyKnob.style.transform = 'translate(0px, 0px)';
        this.joyBase.classList.add('on');
        this.stage.setPointerCapture?.(e.pointerId);
      } else {
        this.taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, lastX: e.clientX });
      }
      if (this.taps.size === 2) {
        const [a, b] = [...this.taps.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    });
    on(this.stage, 'pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerId === this.joy.id) {
        const dx = e.clientX - this.joy.ox;
        const dy = e.clientY - this.joy.oy;
        const d = Math.hypot(dx, dy);
        const max = 52;
        const k = d > max ? max / d : 1;
        this.joy.x = (dx * k) / max;
        this.joy.y = (dy * k) / max;
        this.joyKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        return;
      }
      const tap = this.taps.get(e.pointerId);
      if (tap) {
        if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap.moved = true;
        if (tap.moved && this.taps.size === 1 && (e.pointerType !== 'mouse' || e.buttons & 1)) {
          // drag to orbit the camera around the player
          this.yawDelta -= (e.clientX - tap.lastX) * 0.0085;
          this.dragging = true;
        }
        tap.lastX = e.clientX;
        if (this.pinch && this.taps.size === 2) {
          tap.x = e.clientX;
          tap.y = e.clientY;
          const [a, b] = [...this.taps.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.zoom = Math.min(1.5, Math.max(0.6, this.zoom * (this.pinch.d / d)));
          this.pinch.d = d;
        }
      } else if (e.pointerType === 'mouse') this.onHover?.(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.joy.id) {
        this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
        this.joyBase.classList.remove('on');
        return;
      }
      const tap = this.taps.get(e.pointerId);
      this.taps.delete(e.pointerId);
      if (this.taps.size < 2) this.pinch = null;
      if (!this.taps.size) this.dragging = false;
      if (tap && !tap.moved && performance.now() - tap.t < 450 && e.type === 'pointerup' && this.enabled) this.onTap?.(e.clientX, e.clientY);
    };
    on(this.stage, 'pointerup', end);
    on(this.stage, 'pointercancel', end);
    on(
      this.stage,
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.zoom = Math.min(1.5, Math.max(0.6, this.zoom * (1 + Math.sign(e.deltaY) * 0.08)));
      },
      { passive: false },
    );
  }

  detach() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.reset();
  }

  reset() {
    this.keys.clear();
    this.edges.clear();
    this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.joyBase.classList.remove('on');
  }

  press(a: Action) {
    this.edges.add(a);
  }

  /** Reads the gamepad once per frame. */
  pollGamepad() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) {
      this.padAxis = { x: 0, y: 0 };
      this.padRun = false;
      return;
    }
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    let x = dz(pad.axes[0] ?? 0);
    let y = dz(pad.axes[1] ?? 0);
    const b = pad.buttons.map((btn) => btn.pressed);
    if (b[12]) y = -1;
    if (b[13]) y = 1;
    if (b[14]) x = -1;
    if (b[15]) x = 1;
    if (x || y || b.some(Boolean)) this.usedPad = true;
    this.padAxis = { x, y };
    this.padRun = !!(b[1] || b[7] || b[10]);
    const edge = (i: number) => b[i] && !this.padPrev[i];
    if (this.enabled) {
      if (edge(0)) this.edges.add('action');
      if (edge(2)) this.edges.add('jump');
      if (edge(3)) this.edges.add('map');
      if (edge(9)) this.edges.add('pause');
    }
    this.padPrev = b;
  }

  /** Screen-relative direction: x = right, z = down (toward the camera). */
  axis() {
    let x = 0;
    let z = 0;
    for (const k of this.keys) {
      const v = KEYMAP[k];
      if (v) {
        x += v[0];
        z += v[1];
      }
    }
    x += this.joy.x + this.padAxis.x;
    z += this.joy.y + this.padAxis.y;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  get running() {
    return this.keys.has('Shift') || this.padRun || Math.hypot(this.joy.x, this.joy.y) > 0.92;
  }

  consume(a: Action) {
    const had = this.edges.has(a);
    this.edges.delete(a);
    return had;
  }
}

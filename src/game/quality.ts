/* Picks a rendering quality for this device, and adapts the resolution while playing. */

export interface Quality {
  tier: 'high' | 'medium' | 'low';
  dpr: number;
  maxDpr: number;
  antialias: boolean;
  shadows: boolean;
  shadowSize: number;
  grass: number;
  flowers: number;
}

const TIERS: Record<Quality['tier'], Omit<Quality, 'tier' | 'dpr'>> = {
  high: { maxDpr: 2, antialias: true, shadows: true, shadowSize: 2048, grass: 700, flowers: 260 },
  medium: { maxDpr: 1.5, antialias: true, shadows: true, shadowSize: 1024, grass: 420, flowers: 190 },
  low: { maxDpr: 1, antialias: false, shadows: false, shadowSize: 512, grass: 180, flowers: 110 },
};

function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return null;
  }
}

export function webglAvailable() {
  return gpuName() !== null;
}

export function detectQuality(): Quality {
  const forced = new URLSearchParams(location.search).get('quality');
  let tier: Quality['tier'];
  if (forced === 'high' || forced === 'medium' || forced === 'low') tier = forced;
  else {
    const gpu = gpuName() ?? '';
    const coarse = matchMedia('(pointer: coarse)').matches;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (/swiftshader|llvmpipe|software|basic render/i.test(gpu) || saveData) tier = 'low';
    else if (coarse) tier = mem >= 6 && cores >= 6 ? 'medium' : 'low';
    else tier = cores >= 8 && mem >= 8 ? 'high' : 'medium';
  }
  const t = TIERS[tier];
  return { tier, ...t, dpr: Math.min(devicePixelRatio || 1, t.maxDpr) };
}

/** Lowers the pixel ratio when frames get slow, raises it again when there's headroom. */
export class FrameGovernor {
  private acc = 0;
  private frames = 0;
  constructor(
    private q: Quality,
    private apply: (dpr: number) => void,
  ) {}
  tick(dt: number) {
    this.acc += dt;
    this.frames++;
    if (this.acc < 2) return;
    const avg = this.acc / this.frames;
    this.acc = 0;
    this.frames = 0;
    if (avg > 1 / 40 && this.q.dpr > 0.75) {
      this.q.dpr = Math.max(0.75, this.q.dpr - 0.25);
      this.apply(this.q.dpr);
    } else if (avg < 1 / 58 && this.q.dpr < Math.min(devicePixelRatio || 1, this.q.maxDpr)) {
      this.q.dpr = Math.min(this.q.maxDpr, this.q.dpr + 0.25);
      this.apply(this.q.dpr);
    }
  }
}

/* A* on a coarse walkability grid, so tap-to-walk finds its way around buildings and palms. */
import { blocked, walkable, type V2 } from '../layout';

const CELL = 0.75;
const MIN_X = -54;
const MIN_Z = -38;
const COLS = Math.ceil(108 / CELL);
const ROWS = Math.ceil(76 / CELL);

let grid: Uint8Array | null = null;

function build() {
  grid = new Uint8Array(COLS * ROWS);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const x = MIN_X + (i + 0.5) * CELL;
      const z = MIN_Z + (j + 0.5) * CELL;
      grid[j * COLS + i] = walkable(x, z) && !blocked(x, z, 0.42) ? 1 : 0;
    }
  return grid;
}

const toCell = (p: V2) => ({ i: Math.floor((p.x - MIN_X) / CELL), j: Math.floor((p.z - MIN_Z) / CELL) });
const toWorld = (i: number, j: number): V2 => ({ x: MIN_X + (i + 0.5) * CELL, z: MIN_Z + (j + 0.5) * CELL });
const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < COLS && j < ROWS;

function open(g: Uint8Array, i: number, j: number) {
  return inside(i, j) && g[j * COLS + i] === 1;
}

function nearestOpen(g: Uint8Array, i: number, j: number) {
  if (open(g, i, j)) return { i, j };
  for (let r = 1; r < 14; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (open(g, i + di, j + dj)) return { i: i + di, j: j + dj };
      }
  return null;
}

/** Straight-line check (used to smooth the path). */
function clear(a: V2, b: V2) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(d / 0.3);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (!walkable(x, z) || blocked(x, z, 0.38)) return false;
  }
  return true;
}

export function findPath(from: V2, to: V2): V2[] | null {
  const g = grid ?? build();
  const s0 = toCell(from);
  const e0 = toCell(to);
  const s = nearestOpen(g, s0.i, s0.j);
  const e = nearestOpen(g, e0.i, e0.j);
  if (!s || !e) return null;
  const N = COLS * ROWS;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const startK = s.j * COLS + s.i;
  const endK = e.j * COLS + e.i;
  gScore[startK] = 0;
  // a small binary heap keyed by f-score
  const heap: [number, number][] = [[0, startK]];
  const push = (f: number, k: number) => {
    heap.push([f, k]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - e.i);
    const dz = Math.abs(j - e.j);
    return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  let found = false;
  let iterations = 0;
  while (heap.length && iterations++ < 20000) {
    const [, k] = pop();
    if (closed[k]) continue;
    if (k === endK) {
      found = true;
      break;
    }
    closed[k] = 1;
    const ci = k % COLS;
    const cj = (k / COLS) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (!open(g, ni, nj)) continue;
        if (di && dj && (!open(g, ci + di, cj) || !open(g, ci, cj + dj))) continue; // no corner cutting
        const nk = nj * COLS + ni;
        const cost = gScore[k] + (di && dj ? Math.SQRT2 : 1);
        if (cost < gScore[nk]) {
          gScore[nk] = cost;
          came[nk] = k;
          push(cost + h(ni, nj), nk);
        }
      }
  }
  if (!found) return null;
  const cells: V2[] = [];
  for (let k = endK; k !== -1; k = came[k]) cells.push(toWorld(k % COLS, (k / COLS) | 0));
  cells.reverse();
  cells[cells.length - 1] = walkable(to.x, to.z) && !blocked(to.x, to.z, 0.38) ? to : cells[cells.length - 1];
  // string-pulling: skip waypoints we can walk to directly
  const out: V2[] = [];
  let anchor = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clear(anchor, cells[j])) j--;
    out.push(cells[j]);
    anchor = cells[j];
    i = j + 1;
  }
  return out;
}

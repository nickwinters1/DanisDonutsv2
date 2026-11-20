/* DOM helpers. Every piece of community text goes through esc() (or the html`` template)
 * before it touches innerHTML, so nobody can inject markup into the island. */

export function esc(v: unknown = ''): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Marks a string as trusted markup for html``. */
export class Raw {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}
export const raw = (s: string) => new Raw(s);

/** Tagged template that escapes every interpolation unless it's raw(...) or an array of those. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += toHTML(values[i]);
  });
  return new Raw(out);
}
function toHTML(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(toHTML).join('');
  return esc(v);
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

/** Waits for the next animation frame (handy before measuring/animating). */
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function setHTML(el: Element | null, markup: Raw | string) {
  if (el) el.innerHTML = markup instanceof Raw ? markup.value : markup;
}

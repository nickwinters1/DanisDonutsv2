/* Little notifications. They live in the browser's top layer (popover) when supported,
 * so they show above dialogs and the full-screen island too. */
import { esc } from './dom';

const host = () => document.getElementById('toasts')!;
let popoverReady = false;

function ensureTop() {
  const el = host();
  if (popoverReady) {
    // re-show so the toasts sit above any dialog opened since
    try {
      el.hidePopover();
      el.showPopover();
    } catch {
      /* ignore */
    }
    return;
  }
  if ('showPopover' in el) {
    el.setAttribute('popover', 'manual');
    try {
      el.showPopover();
      popoverReady = true;
    } catch {
      /* not supported */
    }
  }
}

export function toast(text: string, opts: { icon?: string; title?: string; kind?: 'trophy' | 'quest' | 'info'; ms?: number } = {}) {
  ensureTop();
  const el = document.createElement('div');
  el.className = `toast ${opts.kind ?? 'info'}`;
  el.setAttribute('role', 'status');
  el.innerHTML = opts.title
    ? `<span class="toast-ic">${esc(opts.icon ?? '✦')}</span><span><b>${esc(opts.title)}</b><small>${esc(text)}</small></span>`
    : `${opts.icon ? `<span class="toast-ic">${esc(opts.icon)}</span>` : ''}<span>${esc(text)}</span>`;
  const h = host();
  h.append(el);
  while (h.children.length > 4) h.firstElementChild?.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, opts.ms ?? 3600);
}

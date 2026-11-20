/* One shared <dialog> for every panel on the island (native focus trapping + Esc to close). */
import { Raw, esc } from './dom';
import { ICONS } from './icons';
import { sound } from '../lib/sound';

const dialog = () => document.getElementById('dialog') as HTMLDialogElement;
const content = () => document.getElementById('dialog-content')!;
const openFns = new Set<() => void>();
const closeFns = new Set<() => void>();
let wired = false;
let current = '';

export function onDialog(open: () => void, close: () => void) {
  openFns.add(open);
  closeFns.add(close);
}

function wire() {
  if (wired) return;
  wired = true;
  const d = dialog();
  d.addEventListener('close', () => {
    current = '';
    d.className = '';
    closeFns.forEach((fn) => fn());
  });
  // click on the backdrop closes
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
  });
}

export interface DialogOptions {
  /** visual variant: 'wide' | 'cinema' | 'night' | 'letter' | 'organizer' … */
  variant?: string;
  icon?: string;
  /** key used to know which panel is open (e.g. to refresh it) */
  key?: string;
  subtitle?: string;
}

export function openDialog(title: string, body: Raw | string, o: DialogOptions = {}) {
  wire();
  const d = dialog();
  const wasOpen = d.open;
  current = o.key ?? title;
  d.className = o.variant ? `v-${o.variant.split(' ').join(' v-')}` : '';
  content().innerHTML = `<header class="dialog-head">
      ${o.icon ? `<span class="dialog-icon" aria-hidden="true">${o.icon}</span>` : ''}
      <div><h2 id="dialog-title">${esc(title)}</h2>${o.subtitle ? `<p class="dialog-sub">${esc(o.subtitle)}</p>` : ''}</div>
      <button type="button" class="close" data-close aria-label="Close">${ICONS.close}</button>
    </header>
    <div class="dialog-body">${body instanceof Raw ? body.value : body}</div>`;
  if (!wasOpen) {
    d.showModal();
    openFns.forEach((fn) => fn());
    sound.pop();
  } else {
    content().animate?.([{ opacity: 0.4, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
  }
  d.scrollTop = 0;
  content().scrollTop = 0;
  return content();
}

export function closeDialog() {
  const d = dialog();
  if (d.open) d.close();
}

export function dialogOpen(key?: string) {
  return dialog().open && (!key || current === key);
}

export const dialogBody = () => content().querySelector<HTMLElement>('.dialog-body');

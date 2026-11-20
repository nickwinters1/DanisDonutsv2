/* "Open the surprise": an envelope, a letter and confetti — sealed until the organizers open it. */
import { store } from '../data/store';
import { sound } from '../lib/sound';
import { html } from './dom';
import { closeDialog, openDialog } from './dialog';
import { confetti } from './confetti';

let stop: (() => void) | null = null;
let onClosed: (() => void) | null = null;

export function showReveal(after?: () => void) {
  if (!store.event.revealed) {
    openDialog(
      'The surprise is still sealed 🔒',
      html`<p class="dialog-lead">Check back when the organizers open the island. Until then, you can leave a little sweetness for Dani.</p>
        <div class="actions dialog-actions"><button type="button" class="btn" data-contribute>Leave a note</button><button type="button" class="btn light" data-close>Back</button></div>`,
      { key: 'sealed' },
    );
    return;
  }
  closeDialog();
  onClosed = after ?? null;
  const el = document.getElementById('reveal')!;
  el.hidden = false;
  el.classList.remove('play');
  void el.offsetWidth;
  el.classList.add('play');
  document.body.classList.add('locked');
  sound.unlock();
  sound.reveal();
  stop?.();
  stop = confetti(document.getElementById('reveal-confetti') as HTMLCanvasElement, { count: 220, duration: 9000 });
  setTimeout(() => document.getElementById('reveal-close')?.focus(), 300);
}

export function closeReveal() {
  const el = document.getElementById('reveal')!;
  if (el.hidden) return;
  el.hidden = true;
  stop?.();
  stop = null;
  document.body.classList.remove('locked');
  const cb = onClosed;
  onClosed = null;
  if (cb) cb();
  else document.getElementById('messages')?.scrollIntoView({ behavior: 'smooth' });
}

export function wireReveal() {
  document.getElementById('reveal-close')!.addEventListener('click', closeReveal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('reveal')!.hidden) closeReveal();
  });
}

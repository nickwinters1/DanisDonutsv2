/* Note cards (used on the wall and inside every attraction) and the filterable wall itself. */
import { ZONES, zoneById } from '../data/catalog';
import { safeURL, store } from '../data/store';
import type { Category, Message } from '../data/types';
import { avatarSVG } from '../art/art';
import { html, raw, type Raw } from './dom';
import { ICONS } from './icons';
import { openDialog } from './dialog';

export function noteHTML(m: Message, opts: { full?: boolean } = {}): Raw {
  const z = zoneById(m.category);
  const url = safeURL(m.link);
  return html`<article class="note ${opts.full ? 'full' : ''}" style="--note:${z.color}">
    <div class="meta"><span aria-hidden="true">${z.icon}</span> ${z.name}${m.example ? raw(' <span class="tag-sample">Sample</span>') : ''}</div>
    <h3>${m.title || 'A little note'}</h3>
    <p>${m.body}</p>
    ${url ? html`<a class="attachment" href="${url}" target="_blank" rel="noopener noreferrer">${raw(ICONS.external)} Open shared link</a>` : ''}
    <div class="from"><span class="av">${raw(avatarSVG(m.author || 'Anonymous Donut', m.meta?.frosting, m.meta?.sprinkles))}</span>From ${m.author || 'Anonymous Donut'}</div>
    ${store.admin && !m.example && m.id !== 'tip' ? html`<div class="note-mod" role="group" aria-label="Organizer tools for this note">
      <span>Organizer:</span>
      <button type="button" class="mod-btn" data-mod="rejected" data-id="${m.id}">Hide</button>
      <button type="button" class="mod-btn danger" data-mod="delete" data-id="${m.id}">Delete</button>
    </div>` : ''}
  </article>`;
}

/** A single message, opened from an NPC, a bottle, a donut, a crystal… */
export function msgDetail(m: Message, back?: { label: string; exp: string }, via?: 'npc' | 'bottle') {
  const lead =
    via === 'bottle'
      ? '<p class="dialog-lead">🍾 A bottle washed up on the beach. There’s a note inside…</p>'
      : via === 'npc'
        ? `<p class="dialog-lead">💬 ${m.author ? 'A Donut' : 'Someone'} hops over to share their note.</p>`
        : '';
  openDialog(
    m.title || 'A little note',
    html`${raw(lead)}${noteHTML(m, { full: true })}
      <div class="actions dialog-actions">
        ${back ? html`<button type="button" class="btn light" data-exp="${back.exp}">${raw(ICONS.back)} ${back.label}</button>` : ''}
        <button type="button" class="btn" data-close>Back to the island</button>
      </div>`,
    { variant: 'note', key: 'note' },
  );
}

export const FILTERS = [{ id: 'all' as const, icon: '', name: 'All notes' }, ...ZONES];

export function renderWall(filter: 'all' | Category) {
  const ev = store.event;
  const filters = document.getElementById('filters');
  const notes = document.getElementById('notes');
  const desc = document.getElementById('wall-description');
  if (!filters || !notes || !desc) return;
  desc.textContent = store.loadError
    ? 'Could not connect to the shared island.'
    : ev.revealed
      ? 'A little reminder of all the good you put into the world.'
      : 'Messages are safely sealed until the organizers open the surprise.';
  const counts = (id: string) => (id === 'all' ? store.messages.length : store.messages.filter((m) => m.category === id).length);
  filters.innerHTML = FILTERS.map(
    (f) =>
      html`<button type="button" class="chip ${filter === f.id ? 'active' : ''}" data-filter="${f.id}" aria-pressed="${filter === f.id}">${f.id === 'all' ? f.name : `${f.icon} ${f.name}`}${ev.revealed ? html`<span class="n">${counts(f.id)}</span>` : ''}</button>`.value,
  ).join('');
  const shown = store.messages.filter((m) => filter === 'all' || m.category === filter);
  notes.innerHTML = shown.length
    ? shown.map((m) => noteHTML(m).value).join('')
    : html`<div class="empty"><span>${ev.revealed ? '💌' : '🔒'}</span>${ev.revealed ? 'No messages here yet. Be the first to leave one!' : 'The wishes are tucked away until reveal day.'}</div>`.value;
}

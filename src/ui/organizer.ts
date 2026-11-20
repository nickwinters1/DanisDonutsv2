/* The organizer dashboard: sign in, moderate, configure the edition, open the surprise,
 * export, publish to the diary and trigger the live OBS finale. Same rules as the original. */
import { zoneById } from '../data/catalog';
import { safeURL, store } from '../data/store';
import type { Message, Status } from '../data/types';
import { avatarSVG } from '../art/art';
import { html, raw } from './dom';
import { ICONS } from './icons';
import { closeDialog, openDialog } from './dialog';
import { toast } from './toast';

let tab: 'pending' | 'approved' | 'rejected' | 'all' = 'pending';

export async function organizer() {
  if (store.demo) {
    store.enterDemoOrganizer();
    return panel();
  }
  if (store.admin) return panel();
  openDialog(
    'Organizer sign in',
    html`<p class="dialog-lead">Only authorized organizers can review messages and open the shared island.</p>
      <form id="login" class="login">
        <div class="field"><label for="email">Email</label><input type="email" id="email" autocomplete="username" required></div>
        <div class="field"><label for="password">Password</label><input type="password" id="password" autocomplete="current-password" required></div>
        <button class="btn" type="submit">Sign in</button>
        <p class="status" id="login-status" role="status"></p>
      </form>`,
    { icon: '🔐', key: 'organizer' },
  );
  const form = document.getElementById('login') as HTMLFormElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button')!;
    const status = document.getElementById('login-status')!;
    btn.disabled = true;
    status.textContent = 'Signing in…';
    try {
      await store.login((document.getElementById('email') as HTMLInputElement).value, (document.getElementById('password') as HTMLInputElement).value);
      await panel();
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : String(err);
      status.classList.add('error');
      btn.disabled = false;
    }
  };
}

function row(m: Message) {
  const z = zoneById(m.category);
  const url = safeURL(m.link);
  const metaBits = m.meta ? Object.entries(m.meta).map(([k, v]) => `${k}: ${v}`) : [];
  return html`<article class="admin-row s-${m.status}">
    <div class="admin-av">${raw(avatarSVG(m.author || 'Anonymous Donut', m.meta?.frosting, m.meta?.sprinkles))}</div>
    <div class="admin-main">
      <div class="admin-tags"><span class="pill">${z.icon} ${z.short}</span><span class="pill ${m.visibility}">${m.visibility}</span><span class="pill st">${m.status}</span><span class="pill ghost">${m.event_id}</span></div>
      <strong>${m.title || 'Untitled'}</strong> <span class="admin-by">by ${m.author}</span>
      <p>${m.body}</p>
      ${metaBits.length ? html`<p class="hint">Extras: ${metaBits.join(' · ')}</p>` : ''}
      ${url ? html`<a target="_blank" rel="noopener noreferrer" href="${url}">${raw(ICONS.external)} Review link</a>` : ''}
      <div class="admin-actions">
        ${m.status !== 'approved' ? html`<button type="button" class="btn small" data-review="approved" data-id="${m.id}">${raw(ICONS.check)} Approve</button>` : ''}
        ${m.status !== 'rejected' ? html`<button type="button" class="btn light small" data-review="rejected" data-id="${m.id}">Reject</button>` : ''}
        ${m.status !== 'pending' ? html`<button type="button" class="btn light small" data-review="pending" data-id="${m.id}">Back to pending</button>` : ''}
        <button type="button" class="btn light small danger" data-review="delete" data-id="${m.id}">Delete</button>
      </div>
    </div>
  </article>`;
}

export async function panel() {
  try {
    const rows = await store.loadOrganizerRows();
    const count = (s: Status) => rows.filter((m) => m.status === s).length;
    const shown = tab === 'all' ? rows : rows.filter((m) => m.status === tab);
    const ev = store.event;
    openDialog(
      'Island organizer',
      html`<p class="dialog-lead">${store.demo ? 'Local preview only. Anyone on this device can use these test controls.' : 'Private moderation dashboard. Do not open this view while live on stream.'}</p>
        <div class="admin-stats">
          <div><b>${count('pending')}</b><span>pending</span></div>
          <div><b>${count('approved')}</b><span>approved</span></div>
          <div><b>${count('rejected')}</b><span>rejected</span></div>
          <div><b>${rows.length}</b><span>total, all editions</span></div>
        </div>
        <form id="settings" class="admin-card">
          <h3>Edition</h3>
          <div class="formgrid">
            <div class="field"><label for="event-id">Edition ID (letters, numbers, hyphens)</label><input id="event-id" pattern="[a-zA-Z0-9\\-]{1,60}" value="${ev.id}" required></div>
            <div class="field"><label for="event-name">Celebration title</label><input id="event-name" maxlength="100" value="${ev.title}" required></div>
          </div>
          <label class="check toggle"><input type="checkbox" id="is-revealed" ${ev.revealed ? raw('checked') : ''}> <span><b>Open the surprise</b> to every visitor (approved public notes only)</span></label>
          <div class="actions">
            <button class="btn small" type="submit">Save edition settings</button>
            <button type="button" class="btn light small" data-action="export">${raw(ICONS.download)} Export all messages</button>
            ${store.demo ? '' : html`<button type="button" class="btn light small" data-action="logout">Sign out</button>`}
          </div>
          <p class="hint">Changing the edition ID starts a new collection; old messages remain in the organizer archive. Uncheck the reveal box before switching editions.</p>
        </form>
        <div class="admin-card celebrate">
          <h3>Celebration controls</h3>
          <div class="actions">
            <button type="button" class="btn gold small" data-exp="signal">🎆 Trigger live finale</button>
            <button type="button" class="btn light small" data-exp="archive">📔 Publish this edition to the diary</button>
          </div>
          <p class="hint">Only use the finale control when the broadcast operator is ready. Publishing an edition makes its approved public messages accessible in the diary after switching editions.</p>
        </div>
        <h3 class="admin-h">Review submissions</h3>
        <div class="tabs" role="tablist">
          ${(['pending', 'approved', 'rejected', 'all'] as const).map(
            (t) =>
              html`<button type="button" role="tab" class="chip ${tab === t ? 'active' : ''}" aria-selected="${tab === t}" data-admin-tab="${t}">${t[0].toUpperCase() + t.slice(1)}<span class="n">${t === 'all' ? rows.length : count(t)}</span></button>`,
          )}
        </div>
        <div id="admin-list">${shown.length ? shown.map(row) : html`<p class="empty">${rows.length ? 'Nothing in this tab.' : 'No real submissions yet. Sample cards never appear in this dashboard.'}</p>`}</div>`,
      { variant: 'wide organizer', icon: '🛠️', key: 'organizer' },
    );
    const form = document.getElementById('settings') as HTMLFormElement;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        id: (document.getElementById('event-id') as HTMLInputElement).value.trim(),
        title: (document.getElementById('event-name') as HTMLInputElement).value.trim(),
        revealed: (document.getElementById('is-revealed') as HTMLInputElement).checked,
      };
      if (!/^[a-zA-Z0-9-]{1,60}$/.test(data.id)) return toast('Edition IDs use letters, numbers and hyphens only.');
      if (data.id !== ev.id && data.revealed && !confirm('Open this new edition immediately?')) return;
      try {
        await store.saveSettings(data);
        await panel();
        toast('Edition settings saved', { icon: '✅' });
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    };
  } catch (e) {
    openDialog('Organizer unavailable', html`<p>${e instanceof Error ? e.message : String(e)}</p><div class="actions dialog-actions"><button type="button" class="btn" data-close>Close</button></div>`);
  }
}

export function setTab(t: typeof tab) {
  tab = t;
  void panel();
}

export async function review(id: string, status: Status | 'delete') {
  if (!store.admin) return;
  if (status === 'delete' && !confirm('Permanently delete this message?')) return;
  try {
    await store.review(id, status);
    await panel();
    toast(status === 'delete' ? 'Deleted' : `Message ${status}`, { icon: status === 'approved' ? '✅' : '✦' });
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
}

export function exportRows() {
  if (!store.admin) return;
  store.exportRows();
  toast('Private export created. Keep it secure.', { icon: '🔒' });
}

export async function signal() {
  if (!store.admin || !store.event.revealed) {
    toast('Open the shared surprise before sending a finale signal.');
    return;
  }
  if (!confirm('Trigger the live celebration for connected OBS/Streamer.bot clients?')) return;
  try {
    await store.signal();
    toast(store.demo ? 'Local finale signal saved.' : 'Live finale signal sent.', { icon: '🎆' });
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
}

export async function archive() {
  if (!store.admin || !store.event.revealed) {
    toast('Only revealed editions can be published.');
    return;
  }
  if (!confirm('Publish this edition’s approved public notes permanently to the diary? Private and rejected notes stay hidden.')) return;
  try {
    await store.archive();
    toast('Edition published to the diary.', { icon: '📔' });
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
}

export function logout() {
  store.logout();
  closeDialog();
  toast('Signed out');
}

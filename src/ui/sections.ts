/* Renders the dynamic parts of the page: the save file, attractions, island guide, treasures, ribbon. */
import { SITE } from '../config';
import { ATTRACTIONS, ZONES } from '../data/catalog';
import { store } from '../data/store';
import { attractionArt } from '../art/art';
import { RANKS, SPRINKLE_TOTAL, TROPHIES, progress } from '../lib/progress';
import { html, raw } from './dom';
import { islandMapHTML, syncMapLanterns } from './islandMap';

export function renderRibbon() {
  const ev = store.event;
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('event-title', ev.title);
  set('event-state', store.loadError ? '· Connection unavailable' : ev.revealed ? '· Island open' : '· Surprise sealed');
  document.getElementById('event-dot')?.classList.toggle('live', ev.revealed && !store.loadError);
  const n = store.messages.filter((m) => !m.example).length;
  set('mode-label', store.demo ? 'Preview • saved on this device' : ev.revealed ? `Community edition • ${n} note${n === 1 ? '' : 's'} on the island` : 'Community edition');
}

export function renderSavefile(webgl: boolean) {
  const el = document.getElementById('savefile');
  if (!el) return;
  const r = progress.rank;
  const s = progress.state;
  const started = progress.questsDone > 0 || s.walked;
  el.innerHTML = html`<div class="cartridge">
      <div class="cart-title"><small>THE DONUTVERSE</small>Donut Island<br />Adventure</div>
      ${raw(islandMapHTML({ visited: progress.collection, compact: true }))}
      <div class="cart-actions">
        <button type="button" class="btn big" data-play>${webgl ? (started ? '▶ Continue adventure' : '▶ Start adventure') : '🗺️ Explore the island map'}</button>
        <p class="cart-note">${webgl ? 'Walk, jump and explore in 3D. Keyboard, touch and controllers all work.' : 'This device can’t run the 3D island, but every stop is on the island map below.'}</p>
      </div>
    </div>
    <div class="journal">
      <div class="rankbar"><span class="rank-badge">Lv ${r.level} · ${r.name}</span><span class="bar" role="progressbar" aria-label="XP toward next rank" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.pct * 100)}"><i style="width:${Math.round(r.pct * 100)}%"></i></span><span class="xpnum">${progress.xp} XP${r.next ? ` / ${r.next.xp}` : ''}</span></div>
      <div><p class="subhead">Quest journal · ${progress.questsDone}/6</p>
        <div class="questlist">${ZONES.map(
          (z) => html`<button type="button" class="quest ${progress.has(z.id) ? 'done' : ''}" style="--q:${z.color}" data-travel="${z.id}"><span class="qi">${z.icon}</span>${z.short}<span class="qs">${progress.has(z.id) ? '✓ ' + z.treasure : '○'}</span></button>`,
        )}</div></div>
      <div class="statrow">
        <div class="stat"><b>${s.sprinkles.length}<small>/${SPRINKLE_TOTAL}</small></b><span>Sprinkles</span></div>
        <div class="stat"><b>${s.met.length}</b><span>Donuts met</span></div>
        <div class="stat"><b>${s.bottles.length}</b><span>Bottles read</span></div>
        <div class="stat"><b>${s.trophies.length}<small>/${TROPHIES.length}</small></b><span>Trophies</span></div>
      </div>
      <div><p class="subhead">Trophies</p><div class="trophies">${TROPHIES.map((t) => {
        const on = s.trophies.includes(t.id);
        const label = on || !t.secret ? `${t.name}: ${t.desc}` : 'A secret trophy';
        return html`<span class="trophy ${on ? 'on' : 'locked'}" title="${label}" aria-label="${label}${on ? ' (unlocked)' : ' (locked)'}">${on || !t.secret ? t.icon : '?'}</span>`;
      })}</div></div>
      <p class="hint">Ranks: ${RANKS.map((x) => x.name).join(' → ')}</p>
    </div>`.value;
}

export function renderAttractions() {
  const el = document.getElementById('experience-grid');
  if (!el) return;
  el.innerHTML = ATTRACTIONS.map(
    (a, i) =>
      html`<button type="button" class="exp" style="--exp:${a.color}" data-exp="${a.id}"><span class="exp-num">${String(i + 1).padStart(2, '0')}</span><span class="exp-art">${raw(attractionArt(a.icon))}</span><span><strong>${a.name}</strong><small>${a.desc}</small></span></button>`.value,
  ).join('');
}

export function renderGuide() {
  const el = document.getElementById('guide');
  if (!el) return;
  el.innerHTML = html`<div class="guide-map">${raw(islandMapHTML({ visited: progress.collection, goldenFound: progress.state.golden }))}</div>
    <div class="guide-tiles">${ZONES.map(
      (z) => html`<button type="button" class="tile ${progress.has(z.id) ? 'done' : ''}" style="--tile:${z.color}" data-zone="${z.id}"><span class="symbol">${z.icon}</span><span><h3>${z.name}</h3><p>${z.desc}</p></span><span class="tile-state" aria-label="${progress.has(z.id) ? 'visited' : 'not visited yet'}">${progress.has(z.id) ? '✓' : '↗'}</span></button>`,
    )}</div>`.value;
  syncMapLanterns(el, progress.collection);
}

export function renderCollection() {
  const el = document.getElementById('collection');
  const cap = document.getElementById('collection-caption');
  if (!el || !cap) return;
  el.innerHTML = ZONES.map((z) => {
    const on = progress.has(z.id);
    return html`<span class="collect ${on ? 'on' : 'locked'}" title="${z.name}: ${on ? z.treasureName : 'not found'}" aria-label="${z.name}: ${on ? z.treasureName + ' found' : 'not found yet'}">${on ? z.treasure : '?'}</span>`.value;
  }).join('');
  const n = progress.questsDone;
  cap.textContent = `${n} of 6 found. ${n === 6 ? 'You found every island treasure!' : 'Explore each island stop to unlock its keepsake.'}`;
}

export function renderLinks() {
  const el = document.getElementById('links');
  if (!el) return;
  el.innerHTML =
    SITE.links.map((l) => html`<a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`.value).join('') +
    '<button type="button" class="linkbtn" data-action="admin">Organizer</button>';
}

/* Every island attraction (shown in the shared dialog). Behaviour follows the original island:
 * sealed until the reveal, only approved public notes, samples clearly labeled. */
import { SITE } from '../config';
import { CARD_STYLES, GEMS, REGIONS, ZONES, zoneById, type AttractionId } from '../data/catalog';
import { safeURL, store } from '../data/store';
import type { Category, Message, Region } from '../data/types';
import { attractionArt, crystalSVG, donutSVG, styleFor } from '../art/art';
import { progress } from '../lib/progress';
import { get, save } from '../lib/storage';
import { sound } from '../lib/sound';
import { esc, html, raw, type Raw } from './dom';
import { ICONS } from './icons';
import { dialogOpen, openDialog } from './dialog';
import { msgDetail, noteHTML } from './wall';
import { toast } from './toast';

const back = html`<button type="button" class="btn light" data-close>Back</button>`;

export function sealed(title: string, category: Category, icon = '🔒') {
  openDialog(
    title,
    html`<div class="sealed"><div class="sealed-art">${raw(donutSVG({ frosting: 'rainbow', sprinkles: 'stars', face: true, seed: 'sealed' }))}<span class="sealed-lock">${raw(ICONS.lock)}</span></div>
      <p>The community’s treasures are tucked away until reveal day.</p><p class="hint">Until then, you can leave a little sweetness for Dani.</p></div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="${category}">Leave something for Dani</button>${back}</div>`,
    { icon },
  );
}

/* ───────── destinations (the six zones) ───────── */

/** The original "island guide" stop: collect its treasure + read everything left there. */
export function zone(id: Category) {
  const z = zoneById(id);
  if (progress.visit(id)) toast(`Treasure found: ${z.treasure} ${z.treasureName}`, { icon: z.treasure, title: 'Quest complete! +100 XP', kind: 'quest' });
  const list = store.messages.filter((m) => m.category === id);
  openDialog(
    `${z.icon} ${z.name}`,
    html`<p class="dialog-lead">${z.desc}</p>
      <div class="notice">✦ Treasure collected: ${z.treasure} ${z.treasureName}${id === 'capsule' ? ' · Future wishes are collected here; for a truly sealed time capsule, choose private delivery.' : ''}</div>
      <div class="zone-cards">${list.length ? list.map((m) => noteHTML(m)) : html`<div class="empty"><span>${store.event.revealed ? '🌱' : '🔒'}</span>${store.event.revealed ? 'No contributions yet.' : 'This stop is sealed until the big reveal.'}</div>`}</div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="${id}">Leave something here</button><button type="button" class="btn light" data-close>Back to the island</button></div>`,
    { key: `zone-${id}`, subtitle: z.sub },
  );
}

/** What opens when you walk into a destination on the 3D island. */
export function openZoneAttraction(id: Category) {
  const z = zoneById(id);
  if (z.action === 'capsule') return zone('capsule');
  experience(z.action);
}

/* ───────── Community Donut Box ───────── */

function listButtons(rows: Message[], kind: 'donut' | 'crystal') {
  return rows.map((m) => {
    const s = styleFor(m.author, m.meta?.frosting, m.meta?.sprinkles);
    return html`<button type="button" class="tray-item" data-msg="${m.id}" aria-label="${kind === 'donut' ? 'Donut' : 'Crystal'} from ${m.author}: ${m.title || 'A little note'}">
      ${raw(kind === 'donut' ? donutSVG({ ...s, seed: m.id }) : crystalSVG(m.meta?.crystal))}
      <span>${m.author}</span>${m.example ? raw('<small class="tag-sample">Sample</small>') : ''}</button>`;
  });
}

function boxView() {
  if (!store.event.revealed) return sealed('🍩 Community Donut Box', 'note');
  const rows = store.messages.filter((m) => m.category === 'note');
  openDialog(
    'Community Donut Box',
    html`<p class="dialog-lead">Every donut is a little message. Pick one to read the note inside.</p>
      <div class="notice">${rows.length} sweet contribution${rows.length === 1 ? '' : 's'}${store.demo ? ' · includes labeled samples' : ''}</div>
      <div class="donut-box">
        <div class="box-lid" aria-hidden="true"><span>Dani’s Donuts</span></div>
        ${rows.length ? html`<div class="donut-tray">${listButtons(rows, 'donut')}</div>` : html`<div class="empty">The box is waiting for its first donut.</div>`}
      </div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="note">Decorate my own donut</button>${back}</div>`,
    { variant: 'wide', icon: '🍩', key: 'donuts' },
  );
}

/* ───────── Crystal of Kindness ───────── */

function crystalView() {
  if (!store.event.revealed) return sealed('💎 Crystal of Kindness', 'letter');
  const rows = store.messages.filter((m) => m.category === 'letter');
  openDialog(
    'Crystal of Kindness',
    html`<p class="dialog-lead">Every approved open-when letter adds a gem to the cove. Choose a crystal whenever you need a little encouragement.</p>
      <div class="notice">${rows.length} crystal${rows.length === 1 ? '' : 's'} collected</div>
      ${rows.length ? html`<div class="crystal-cave">${listButtons(rows, 'crystal')}</div>` : html`<div class="empty">Be the first to leave a crystal.</div>`}
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="letter">Add a crystal</button>${back}</div>`,
    { variant: 'wide night', icon: '💎', key: 'crystals' },
  );
}

/* ───────── Community Booster Packs ───────── */

function cardHTML(m: Message, i: number, faceDown = false): Raw {
  const st = CARD_STYLES[m.meta?.cardStyle ?? 'collector'] ?? CARD_STYLES.collector;
  const url = safeURL(m.link);
  const no = (Math.abs([...m.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 900) + 100;
  return html`<article class="tcard r-${st.rarity.toLowerCase()} ${faceDown ? 'down' : ''}" style="--a:${st.from};--b:${st.to};--ink:${st.ink};--d:${i * 0.12}s" tabindex="0" data-card aria-label="${st.label} card: ${m.title || m.author}">
    <div class="tcard-inner">
      <div class="tcard-front">
        <header><span class="tc-rarity">${raw('★'.repeat(Math.max(1, ['Uncommon', 'Rare', 'Epic', 'Holo', 'Legendary'].indexOf(st.rarity) + 1)))} ${st.rarity}</span><span>${st.label}</span></header>
        <div class="tc-art"><span>${st.icon}</span></div>
        <strong class="tc-name">${m.title || m.author}</strong>
        <p class="tc-text">${m.body.length > 160 ? m.body.slice(0, 157) + '…' : m.body}</p>
        ${url ? html`<a class="tc-link" href="${url}" target="_blank" rel="noopener noreferrer">View art ↗</a>` : ''}
        <footer><span>From ${m.author}</span><span>#${no}</span></footer>
        ${m.example ? raw('<span class="tc-sample">Illustrative sample</span>') : ''}
        <div class="tc-foil" aria-hidden="true"></div><div class="tc-glare" aria-hidden="true"></div>
      </div>
      <div class="tcard-back" aria-hidden="true"><span>${raw(donutSVG({ frosting: 'strawberry', sprinkles: 'rainbow', seed: 'back' }))}</span><b>Donutverse</b><small>Community booster</small></div>
    </div>
  </article>`;
}

function packView() {
  if (!store.event.revealed) return sealed('🃏 Community Booster Packs', 'card');
  const rows = store.messages.filter((m) => m.category === 'card');
  const key = 'ddi-packs-' + store.event.id;
  const opened = new Set(get<string[]>(key, []));
  const countText = () => `${rows.filter((m) => opened.has(m.id)).length} / ${rows.length} community cards discovered`;
  openDialog(
    'Community Booster Packs',
    html`<p class="dialog-lead">Unwrap original, fan-made cards contributed by the Donuts. No purchases, no real trading-card packs.</p>
      <div class="notice" id="pack-count">${countText()}</div>
      <div class="pack-stage" id="pack-stage">
        <button type="button" class="pack" id="rip-pack" ${rows.length ? '' : raw('disabled')}>
          <span class="pack-foil" aria-hidden="true"></span>
          <span class="pack-logo">${raw(donutSVG({ frosting: 'strawberry', sprinkles: 'rainbow', seed: 'pack' }))}</span>
          <span class="pack-name">Donutverse</span><small>COMMUNITY BOOSTER</small><small class="pack-cta">${rows.length ? 'TAP TO OPEN' : 'NO CARDS YET'}</small>
        </button>
      </div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="card">Create a card</button><button type="button" class="btn light" id="view-binder">View binder</button>${back}</div>`,
    { variant: 'wide packs', icon: '🃏', key: 'packs' },
  );
  const stage = document.getElementById('pack-stage')!;
  document.getElementById('rip-pack')!.onclick = () => {
    const remaining = rows.filter((m) => !opened.has(m.id));
    const pool = (remaining.length ? remaining : rows).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pull = pool.slice(0, 3);
    pull.forEach((m) => opened.add(m.id));
    save(key, [...opened]);
    document.getElementById('pack-count')!.textContent = countText();
    const pack = document.getElementById('rip-pack')!;
    pack.classList.add('ripping');
    sound.paper();
    setTimeout(() => {
      stage.innerHTML = html`<div class="pack-cards">${pull.map((m, i) => cardHTML(m, i, true))}</div>
        <p class="hint center">Tap each card to flip it.</p>
        <button type="button" class="btn small" data-exp="packs">Open another pack</button>`.value;
      stage.querySelectorAll<HTMLElement>('.tcard').forEach((c, i) => setTimeout(() => c.classList.add('dealt'), 80 + i * 140));
    }, 650);
  };
  document.getElementById('view-binder')!.onclick = () => {
    const got = rows.filter((m) => opened.has(m.id));
    stage.innerHTML = html`<div class="pack-cards binder">${got.length ? got.map((m, i) => cardHTML(m, i)) : html`<p class="empty">No cards discovered yet.</p>`}</div><button type="button" class="btn light small" data-exp="packs">Back to packs</button>`.value;
    stage.querySelectorAll<HTMLElement>('.tcard').forEach((c) => c.classList.add('dealt'));
  };
}

/** Holographic tilt for trading cards (pointer position → CSS variables). */
export function wireCardTilt(root: HTMLElement) {
  root.addEventListener('pointermove', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.tcard:not(.down)');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--rx', `${(0.5 - y) * 18}deg`);
    card.style.setProperty('--ry', `${(x - 0.5) * 22}deg`);
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
  });
  root.addEventListener(
    'pointerleave',
    (e) => {
      const card = (e.target as HTMLElement).closest?.<HTMLElement>('.tcard');
      card?.style.removeProperty('--rx');
      card?.style.removeProperty('--ry');
    },
    true,
  );
  root.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.tcard.down');
    if (!card || (e.target as HTMLElement).closest('a')) return;
    card.classList.remove('down');
    sound.flip();
    setTimeout(() => sound.crystal(), 140);
  });
}

/* ───────── Sunset Cinema ───────── */

export function mediaType(link: string | null) {
  try {
    const u = new URL(link ?? '');
    if (u.protocol !== 'https:') return null;
    let id: string | undefined;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(u.hostname)) id = u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return { type: 'youtube' as const, url: 'https://www.youtube-nocookie.com/embed/' + id };
    if (/\.(mp4|webm)$/i.test(u.pathname)) return { type: 'video' as const, url: u.href };
  } catch {
    /* not a URL */
  }
  return null;
}

function cinema() {
  if (!store.event.revealed) return sealed('🎬 Sunset Cinema', 'clip');
  const rows = store.messages.filter((m) => m.category === 'clip');
  const withLinks = rows.filter((m) => safeURL(m.link));
  const stories = rows.filter((m) => !safeURL(m.link));
  openDialog(
    'Sunset Cinema',
    html`<div class="marquee" aria-hidden="true">${raw(Array.from({ length: 18 }, () => '<i></i>').join(''))}</div>
      <div class="cinema-screen" id="cinema-screen"><div><div class="cinema-sun" aria-hidden="true"></div><h3>Tonight’s special feature</h3><p>Pick a community video below.</p></div></div>
      <p class="hint">YouTube and direct MP4/WebM links can play here when their hosts allow it. Other links, including Twitch clips, open in a new tab.</p>
      <div class="zone-cards">${withLinks.map(
        (m) => html`<article class="note clip" style="--note:#efe8fb"><strong>${m.title || 'Community clip'}</strong><p>${m.body}</p>
          <div class="actions">${mediaType(m.link) ? html`<button type="button" class="btn small" data-play="${m.id}">${raw(ICONS.play)} Play here</button>` : ''}<a class="attachment" href="${safeURL(m.link)}" target="_blank" rel="noopener noreferrer">${raw(ICONS.external)} Open video</a></div>
          <small>From ${m.author}${m.example ? ' · Sample' : ''}</small></article>`,
      )}${stories.map((m) => noteHTML(m))}${rows.length ? '' : html`<div class="empty">No approved video links yet. Add the documentary or a favorite clip.</div>`}</div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="clip">Submit a clip or video</button><button type="button" class="btn light" data-exp="arcade">Arcade games</button>${back}</div>`,
    { variant: 'wide cinema', icon: '🎬', key: 'cinema' },
  );
}

export function playMedia(m: Message) {
  const t = mediaType(m.link);
  const el = document.getElementById('cinema-screen');
  if (!t || !el) return;
  el.classList.add('playing');
  el.innerHTML =
    t.type === 'youtube'
      ? `<iframe title="Community video" src="${esc(t.url)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<video controls playsinline preload="metadata" src="${esc(t.url)}"></video>`;
}

/* ───────── Victory Arcade hub ───────── */

function arcade() {
  openDialog(
    'Victory Arcade',
    html`<p class="dialog-lead">Clips, gaming adventures and two tiny games. Pick a cabinet.</p>
      <div class="cabinets">
        <button type="button" class="cabinet" data-exp="cinema" style="--c:#9d86de">${raw(attractionArt('film'))}<b>Sunset Cinema</b><small>Community clips & videos</small></button>
        <button type="button" class="cabinet" data-exp="drop" style="--c:#ff8fc7">${raw(attractionArt('gamepad'))}<b>Donut Drop</b><small>60-second arcade dash</small></button>
        <button type="button" class="cabinet" data-exp="game" style="--c:#8fd3c7">${raw(attractionArt('sprinkles'))}<b>Sprinkle Hunt</b><small>A quick memory game</small></button>
      </div>
      <p class="hint center">Best scores: Donut Drop ${progress.state.dropBest || '—'} · Sprinkle Hunt ${progress.state.memoryBest ? `${progress.state.memoryBest} moves` : '—'}</p>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="clip">Share a clip</button>${back}</div>`,
    { variant: 'wide arcade', icon: '🎮', key: 'arcade' },
  );
}

/* ───────── Donuts Around the World ───────── */

const CONTINENTS = [
  'M38 55L77 37 120 47 140 34 185 49 203 70 187 85 157 87 151 114 130 120 119 144 98 126 78 116 63 94 45 88Z',
  'M164 139L194 142 222 166 213 201 198 222 190 255 171 273 159 238 150 206 147 170Z',
  'M273 72L295 58 322 62 347 83 331 101 295 108 282 99Z',
  'M284 117L326 112 350 143 331 195 311 224 294 203 273 159Z',
  'M344 63L403 40 462 48 505 69 555 79 563 103 537 125 498 117 481 146 463 160 441 142 422 121 384 128 369 105 343 97Z',
  'M488 204L524 185 558 198 565 221 543 239 507 234 481 219Z',
  'M205 28L235 20 246 42 225 55 206 46Z',
];

function worldMap() {
  if (!store.event.revealed) return sealed('🌎 Donuts Around the World', 'note');
  const counts = Object.fromEntries(Object.keys(REGIONS).map((k) => [k, store.messages.filter((m) => m.meta?.region === k).length])) as Record<Region, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  openDialog(
    'Donuts Around the World',
    html`<p class="dialog-lead">From all over the world, people found a little corner of the internet together. This map counts public contributions, not unique people, and only uses voluntarily shared continents.</p>
      <div class="map-world">
        <svg viewBox="0 0 600 300" aria-label="Stylized approximate world map" role="img">
          <defs><pattern id="wm-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.1" fill="#ffffff" opacity=".45"/></pattern></defs>
          <rect width="600" height="300" fill="url(#wm-dots)"/>
          <g fill="#b9e2c6" stroke="#fffaf0" stroke-width="3" stroke-linejoin="round">${raw(CONTINENTS.map((d) => `<path d="${d}"/>`).join(''))}</g>
          <g fill="none" stroke="#fff" opacity=".5"><path d="M0 150H600M300 0V300" stroke-dasharray="4 6"/></g>
        </svg>
        ${raw(
          (Object.entries(REGIONS) as [Region, (typeof REGIONS)[Region]][])
            .map(
              ([k, r]) =>
                `<button type="button" class="map-pin ${counts[k] ? 'has' : ''}" style="left:${r.x}%;top:${r.y}%" data-region="${k}" aria-label="${esc(r.label)}: ${counts[k]} contributions"><span>${counts[k]}</span></button>`,
            )
            .join(''),
        )}
      </div>
      <p class="hint center">${total} contribution${total === 1 ? '' : 's'} shared a continent so far.</p>
      <div id="region-notes" class="zone-cards"><p class="hint">Tap a region to read its messages. Locations are intentionally broad.</p></div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-contribute>Join the map</button>${back}</div>`,
    { variant: 'wide', icon: '🌎', key: 'worldmap' },
  );
}

export function showRegion(k: Region) {
  const rows = store.messages.filter((m) => m.meta?.region === k);
  const el = document.getElementById('region-notes');
  if (!el) return;
  el.innerHTML = html`<h3>${REGIONS[k].label}</h3>${rows.length ? rows.map((m) => noteHTML(m)) : html`<p>No public contributions from this region yet.</p>`}`.value;
  document.querySelectorAll('.map-pin').forEach((p) => p.classList.toggle('on', (p as HTMLElement).dataset.region === k));
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ───────── Donut Diaries ───────── */

async function diary() {
  if (!store.event.revealed) return sealed('📔 Donut Diaries', 'memory');
  openDialog('Donut Diaries', html`<p class="dialog-lead">Loading the community scrapbook…</p>`, { variant: 'wide diary', icon: '📔', key: 'diary' });
  try {
    const { chapters, rows } = await store.loadDiary();
    if (!dialogOpen('diary')) return;
    openDialog(
      'Donut Diaries',
      html`<p class="dialog-lead">Little chapters of the world Dani made. Organizers can publish completed editions here for future anniversaries.</p>
        <div class="diary-list">${chapters.map((ed) => {
          const list = rows.filter((m) => m.event_id === ed.id);
          return html`<section class="diary-entry"><div class="diary-tape" aria-hidden="true"></div><h3>${ed.title}</h3><small>${ed.id === store.event.id ? 'Current chapter' : 'Published chapter'} · ${list.length} contributions</small>
            <div class="zone-cards">${list.length ? list.map((m) => noteHTML(m)) : html`<p class="hint">No public memories yet.</p>`}</div></section>`;
        })}</div>
        <div class="actions dialog-actions"><button type="button" class="btn" data-contribute="memory">Add a memory</button>${back}</div>`,
      { variant: 'wide diary', icon: '📔', key: 'diary' },
    );
  } catch (err) {
    openDialog('Donut Diaries', html`<p>${err instanceof Error ? err.message : String(err)}</p><div class="actions dialog-actions">${back}</div>`, { key: 'diary' });
  }
}

/* ───────── The Grand Finale ───────── */

export function finaleLetter(onOpen: () => void) {
  openDialog(
    'The final treasure',
    html`<div class="final-letter">
        <div class="final-art" aria-hidden="true">${raw(donutSVG({ frosting: 'strawberry', sprinkles: 'stars', face: true, seed: 'finale' }))}</div>
        <h3>To Dani, with love.</h3>
        ${SITE.finaleLetter.map((p) => html`<p>${p}</p>`)}
        <p class="final-sweet">Life really is sweeter with you.</p>
        <p class="final-sign">With love, Dani’s Donuts ♡</p>
      </div>
      <div class="actions dialog-actions center"><button type="button" class="btn big" id="launch-finale">Open the chest ✨</button>${back}</div>
      <p class="hint center">The island celebration runs on this device. For a coordinated live OBS effect, the broadcast organizer can trigger it separately.</p>`,
    { variant: 'letter', icon: '🎁', key: 'finale' },
  );
  document.getElementById('launch-finale')!.onclick = onOpen;
}

function finale(onOpen: () => void) {
  if (!store.event.revealed) return sealed('🎁 The final treasure', 'capsule');
  if (progress.questsDone < 6) {
    openDialog(
      'The final treasure',
      html`<div class="sealed"><div class="lanterns-row" aria-hidden="true">${ZONES.map((z) => html`<span class="lan ${progress.has(z.id) ? 'lit' : ''}" style="--c:${z.accent}" title="${z.name}"></span>`)}</div>
        <p><b>${6 - progress.questsDone} quest${6 - progress.questsDone === 1 ? '' : 's'} remain.</b> Explore all six destinations to light the lanterns and unlock the finale.</p></div>
        <div class="actions dialog-actions"><button type="button" class="btn" data-play>Keep exploring</button>${back}</div>`,
      { icon: '🎁', key: 'finale' },
    );
    return;
  }
  finaleLetter(onOpen);
}

/* ───────── dispatcher ───────── */

export interface ExperienceHooks {
  onFinale: () => void;
  game: () => void;
  drop: () => void;
  signal: () => void;
  signalTest: () => void;
  archive: () => void;
}
let hooks: ExperienceHooks;
export function setExperienceHooks(h: ExperienceHooks) {
  hooks = h;
}

export function experience(id: AttractionId | 'signal' | 'signal-test' | 'archive') {
  sound.click();
  switch (id) {
    case 'donuts':
      return boxView();
    case 'crystals':
      return crystalView();
    case 'packs':
      return packView();
    case 'cinema':
      return cinema();
    case 'worldmap':
      return worldMap();
    case 'diary':
      return void diary();
    case 'finale':
      return finale(hooks.onFinale);
    case 'game':
      return hooks.game();
    case 'drop':
      return hooks.drop();
    case 'arcade':
      return arcade();
    case 'capsule':
      return zone('capsule');
    case 'signal':
      return hooks.signal();
    case 'signal-test':
      return hooks.signalTest();
    case 'archive':
      return hooks.archive();
  }
}

/** Message detail with a way back to the attraction it came from. */
export function openMessageById(id: string) {
  const m = store.messages.find((x) => x.id === id);
  if (!m) return;
  const backTo: Record<Category, { label: string; exp: string }> = {
    letter: { label: 'Back to the crystals', exp: 'crystals' },
    note: { label: 'Back to the donut box', exp: 'donuts' },
    card: { label: 'Back to the packs', exp: 'packs' },
    memory: { label: 'Back to the diaries', exp: 'diary' },
    clip: { label: 'Back to the cinema', exp: 'cinema' },
    capsule: { label: 'Back to the treasure chest', exp: 'capsule' },
  };
  msgDetail(m, backTo[m.category], undefined);
  if (m.category === 'letter') document.getElementById('dialog')!.classList.add('v-letter');
}

export { GEMS };

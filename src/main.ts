/* Dani's Donut Island — page boot: renders the sections, wires every button, keeps data live,
 * and lazy-loads the 3D island (hero diorama → full-screen adventure). */
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/fredoka/wght.css';
import './styles/base.css';
import './styles/site.css';
import './styles/dialog.css';
import './styles/game.css';
import './styles/reveal.css';

import { SECRET_KEY_BLOCKED } from './config';
import type { AttractionId } from './data/catalog';
import { store } from './data/store';
import type { Category, Region, Status } from './data/types';
import { progress } from './lib/progress';
import { sound } from './lib/sound';
import { $, reducedMotion } from './ui/dom';
import { ICONS } from './ui/icons';
import { closeDialog, onDialog } from './ui/dialog';
import { toast } from './ui/toast';
import { burst } from './ui/confetti';
import { contribute } from './ui/contribute';
import { archive, exportRows, logout, organizer, review, setTab, signal } from './ui/organizer';
import { showReveal, wireReveal } from './ui/reveal';
import { renderWall, msgDetail } from './ui/wall';
import { donutDrop, sprinkleHunt } from './ui/games';
import { experience, finaleLetter, openMessageById, openZoneAttraction, playMedia, setExperienceHooks, showRegion, wireCardTilt, zone } from './ui/attractions';
import { renderAttractions, renderCollection, renderGuide, renderLinks, renderRibbon, renderSavefile } from './ui/sections';
import type { IslandGame } from './game/index';
import { webglAvailable } from './game/quality';

let filter: 'all' | Category = 'all';
const WEBGL = webglAvailable();
let game: IslandGame | null = null;
let gameLoading: Promise<IslandGame | null> | null = null;
let inGame = false;

/* ───────── rendering ───────── */

function renderAll() {
  renderRibbon();
  renderWall(filter);
  renderSavefile(WEBGL);
  renderGuide();
  renderCollection();
}

/* ───────── the 3D island ───────── */

function loadGame() {
  if (!WEBGL) return Promise.resolve(null);
  gameLoading ??= import('./game/index')
    .then(({ createIsland }) =>
      createIsland({
        getMessages: () => store.messages,
        isRevealed: () => store.event.revealed && !store.loadError,
        openZone: (id) => openZoneAttraction(id),
        openMessage: (m, via) => msgDetail(m, undefined, via),
        openAttraction: (id) => experience(id),
        canFinale: () => store.event.revealed && !store.loadError && progress.allQuests,
        showFinaleLetter: () => finaleLetter(() => finaleOpen()),
        toast: (t) => toast(t),
        requestExit: () => closeGame(),
      }),
    )
    .then((g) => {
      game = g;
      if (import.meta.env.DEV) (window as unknown as { __island: IslandGame }).__island = g;
      const hero = document.getElementById('hero-art')!;
      g.mountHero(hero);
      requestAnimationFrame(() => hero.classList.add('live'));
      return g;
    })
    .catch((err) => {
      console.error('The 3D island could not start', err);
      return null;
    });
  return gameLoading;
}

async function openGame(travel?: string) {
  if (!WEBGL) {
    document.getElementById('island')?.scrollIntoView({ behavior: 'smooth' });
    toast('This device can’t run the 3D island, but every stop is on the island map.', { icon: '🗺️' });
    return;
  }
  sound.unlock();
  closeDialog();
  const overlay = document.getElementById('game')!;
  const hero = document.getElementById('hero-art')!;
  // zoom out of the hero card into full screen
  const r = hero.getBoundingClientRect();
  const visible = r.bottom > 0 && r.top < innerHeight;
  overlay.hidden = false;
  overlay.classList.remove('ready');
  if (visible && !reducedMotion()) {
    overlay.style.setProperty('--clip-t', `${Math.max(0, r.top)}px`);
    overlay.style.setProperty('--clip-l', `${Math.max(0, r.left)}px`);
    overlay.style.setProperty('--clip-r', `${Math.max(0, innerWidth - r.right)}px`);
    overlay.style.setProperty('--clip-b', `${Math.max(0, innerHeight - r.bottom)}px`);
    overlay.classList.add('opening');
    void overlay.offsetWidth;
    requestAnimationFrame(() => overlay.classList.remove('opening'));
  }
  document.body.classList.add('locked');
  inGame = true;
  // the back button / gesture leaves the island instead of the page
  if (history.state?.island !== 1) history.pushState({ island: 1 }, '', '#play');
  const g = await loadGame();
  if (!g || !inGame) {
    if (!g) {
      closeGame();
      toast('The 3D island couldn’t start on this device. Try the island map instead.', { icon: '🗺️' });
    }
    return;
  }
  g.enter(overlay);
  overlay.classList.add('ready');
  if (travel) setTimeout(() => g.travelTo(travel), 900);
}

function closeGame(fromHistory = false) {
  if (!inGame) return;
  inGame = false;
  game?.leave();
  const overlay = document.getElementById('game')!;
  overlay.hidden = true;
  overlay.classList.remove('ready');
  document.body.classList.remove('locked');
  if (!fromHistory && history.state?.island === 1) history.back();
  else if (location.hash === '#play') history.replaceState(null, '', location.pathname + location.search);
  renderSavefile(WEBGL);
}

function finaleOpen() {
  closeDialog();
  progress.flag('finale');
  showReveal(() => {
    if (inGame) closeGame();
    document.getElementById('messages')?.scrollIntoView({ behavior: 'smooth' });
  });
  toast('Adventure complete! 🍩', { icon: '🎆' });
}

/* ───────── events ───────── */

function wireClicks() {
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLElement>('button, [data-play]');
    if (!b) return;
    const d = b.dataset;
    if ('close' in d) closeDialog();
    else if ('contribute' in d) contribute((d.contribute as Category) || 'note');
    else if ('play' in d) void openGame();
    else if (d.travel) void openGame(d.travel);
    else if (d.zone) zone(d.zone as Category);
    else if (d.mapZone && !b.closest('.hud')) {
      if (d.mapZone === 'worldmap' || d.mapZone === 'finale') experience(d.mapZone as AttractionId);
      else zone(d.mapZone as Category);
    } else if (d.filter) {
      filter = d.filter as typeof filter;
      renderWall(filter);
    } else if (d.review) void review(d.id!, d.review as Status | 'delete');
    else if (d.adminTab) setTab(d.adminTab as 'pending');
    else if (d.exp) experience(d.exp as AttractionId);
    else if (d.msg) openMessageById(d.msg);
    else if (d.play) playMedia(store.messages.find((m) => m.id === d.play)!);
    else if (d.region) showRegion(d.region as Region);
    else if (d.action === 'reveal') showReveal();
    else if (d.action === 'admin') void organizer();
    else if (d.action === 'export') exportRows();
    else if (d.action === 'logout') logout();
    else if (d.action === 'sound') {
      sound.unlock();
      sound.toggle();
    }
  });
}

function syncSoundButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-action="sound"]').forEach((b) => {
    b.innerHTML = sound.enabled ? ICONS.soundOn : ICONS.soundOff;
    b.setAttribute('aria-label', sound.enabled ? 'Sound on' : 'Sound off');
    b.setAttribute('aria-pressed', String(sound.enabled));
  });
}

function wireScroll() {
  const top = $('#top');
  const onScroll = () => top?.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      }),
    { rootMargin: '0px 0px -8% 0px' },
  );
  document.querySelectorAll('.section-head, .savefile, .experience-grid, .guide, .message-section, .treasure').forEach((el) => {
    // only animate things that start below the fold
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.classList.add('rise');
    io.observe(el);
  });
  // safety net: never leave content hidden (printing, odd browsers, jump links)
  addEventListener('hashchange', () => document.querySelectorAll('.rise').forEach((el) => el.classList.add('in')));
  addEventListener('beforeprint', () => document.querySelectorAll('.rise').forEach((el) => el.classList.add('in')));
}

/** ↑ ↑ ↓ ↓ ← → ← → B A */
function konami() {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let i = 0;
  addEventListener('keydown', (e) => {
    if (inGame) return;
    i = e.key === code[i] ? i + 1 : e.key === code[0] ? 1 : 0;
    if (i === code.length) {
      i = 0;
      sound.unlock();
      sound.golden();
      burst();
      toast('Sprinkle mode activated! You found a secret 🍩', { icon: '🌈' });
    }
  });
}

/* ───────── boot ───────── */

async function boot() {
  renderLinks();
  renderAttractions();
  renderAll();
  syncSoundButtons();
  wireClicks();
  wireReveal();
  wireScroll();
  wireCardTilt(document.getElementById('dialog')!);
  konami();
  sound.onChange(syncSoundButtons);
  setExperienceHooks({ onFinale: finaleOpen, game: sprinkleHunt, drop: donutDrop, signal: () => void signal(), archive: () => void archive() });
  onDialog(
    () => game?.setPaused(true),
    () => game?.setPaused(false),
  );
  progress.onChange(() => {
    renderSavefile(WEBGL);
    renderGuide();
    renderCollection();
  });
  progress.onTrophy((t) => {
    sound.trophy();
    toast(t.desc, { icon: t.icon, title: `Trophy unlocked: ${t.name}`, kind: 'trophy', ms: 4200 });
  });
  store.onChange(() => {
    renderRibbon();
    renderWall(filter);
    game?.refresh();
  });
  store.onReveal(() => {
    sound.unlock();
    burst();
    toast('The organizers just opened the surprise. Go explore!', { icon: '🎉', title: 'The island is open!', kind: 'quest', ms: 6000 });
  });
  if (SECRET_KEY_BLOCKED) toast('Configuration problem: a secret Supabase key was supplied and ignored. Use the public anon key.', { icon: '⚠️', ms: 10000 });

  await store.refresh();
  store.startWatching();

  // hash shortcuts: #organizer, #play
  if (location.hash === '#organizer' || location.hash === '#admin') void organizer();
  if (location.hash === '#play') {
    history.replaceState(null, '', location.pathname + location.search);
    void openGame();
  }

  // load the 3D island once the page has painted (it's a separate download)
  if (WEBGL) {
    const go = () => void loadGame();
    if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 600);
  }
  addEventListener('popstate', () => {
    if (inGame && history.state?.island !== 1) closeGame(true);
  });
  // UI sounds can only start after the first tap or key press
  const unlock = () => sound.unlock();
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
}

void boot();

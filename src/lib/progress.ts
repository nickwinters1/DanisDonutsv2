/* Adventure progress, saved on this device: quests (treasures), sprinkles, Donuts met,
 * bottles read, secrets, trophies, XP and rank. Shared by the page and the 3D island. */
import type { Category } from '../data/types';
import { get, remove, save } from './storage';

export const SPRINKLE_TOTAL = 40;

export interface Trophy {
  id: string;
  icon: string;
  name: string;
  desc: string;
  secret?: boolean;
}

export const TROPHIES: Trophy[] = [
  { id: 'first-steps', icon: '👣', name: 'First steps', desc: 'Take your first steps on Donut Island.' },
  { id: 'sweet-tooth', icon: '🍬', name: 'Sweet tooth', desc: 'Collect your first sprinkle.' },
  { id: 'social', icon: '💬', name: 'Social donut', desc: 'Meet three Donuts on the island.' },
  { id: 'bottle', icon: '🍾', name: 'Bottle mail', desc: 'Read a message in a bottle.' },
  { id: 'splash', icon: '🌊', name: 'Splash!', desc: 'Wade into the lagoon.' },
  { id: 'hops', icon: '🦘', name: 'Hop, skip, jump', desc: 'Jump 25 times.' },
  { id: 'explorer', icon: '🧭', name: 'Island explorer', desc: 'Visit all six destinations.' },
  { id: 'sprinkles', icon: '🌈', name: 'Sprinkle collector', desc: `Collect all ${SPRINKLE_TOTAL} sprinkles.` },
  { id: 'memory', icon: '🧠', name: 'Sharp memory', desc: 'Win a round of Sprinkle Hunt.' },
  { id: 'arcade', icon: '🕹️', name: 'Arcade star', desc: 'Score 300 or more in Donut Drop.' },
  { id: 'golden', icon: '🏆', name: 'The golden donut', desc: 'Find the secret golden donut.', secret: true },
  { id: 'finale', icon: '🎆', name: 'Life is sweeter', desc: 'Open the grand finale.' },
];

export const RANKS = [
  { xp: 0, name: 'Sprinkle' },
  { xp: 150, name: 'Glazed' },
  { xp: 350, name: 'Frosted' },
  { xp: 600, name: 'Filled' },
  { xp: 900, name: 'Golden' },
  { xp: 1250, name: 'Legendary Donut' },
];

interface State {
  sprinkles: number[];
  met: string[];
  bottles: string[];
  golden: boolean;
  trophies: string[];
  jumps: number;
  finale: boolean;
  memoryBest: number;
  dropBest: number;
  walked: boolean;
  splashed: boolean;
}

const EMPTY: State = {
  sprinkles: [],
  met: [],
  bottles: [],
  golden: false,
  trophies: [],
  jumps: 0,
  finale: false,
  memoryBest: 0,
  dropBest: 0,
  walked: false,
  splashed: false,
};

type Fn<T> = (v: T) => void;

class Progress {
  /** Visited destinations — the original island's `ddi-collection` key, kept compatible. */
  collection: Category[] = get<Category[]>('ddi-collection', []).filter((c) => typeof c === 'string');
  state: State = { ...EMPTY, ...get<Partial<State>>('ddi-island-progress', {}) };
  private change = new Set<() => void>();
  private trophyFns = new Set<Fn<Trophy>>();
  private questFns = new Set<Fn<Category>>();

  onChange(fn: () => void) {
    this.change.add(fn);
    return () => this.change.delete(fn);
  }
  onTrophy(fn: Fn<Trophy>) {
    this.trophyFns.add(fn);
    return () => this.trophyFns.delete(fn);
  }
  onQuest(fn: Fn<Category>) {
    this.questFns.add(fn);
    return () => this.questFns.delete(fn);
  }

  private persist() {
    save('ddi-collection', this.collection);
    save('ddi-island-progress', this.state);
    this.checkTrophies();
    this.change.forEach((fn) => fn());
  }

  has(id: Category) {
    return this.collection.includes(id);
  }
  get questsDone() {
    return this.collection.length;
  }
  get allQuests() {
    return this.collection.length >= 6;
  }

  /** Returns true when this visit completed a new quest. */
  visit(id: Category) {
    if (this.collection.includes(id)) return false;
    this.collection = [...this.collection, id];
    this.persist();
    this.questFns.forEach((fn) => fn(id));
    return true;
  }

  sprinkle(i: number) {
    if (this.state.sprinkles.includes(i)) return false;
    this.state.sprinkles = [...this.state.sprinkles, i];
    this.persist();
    return true;
  }
  meet(id: string) {
    if (this.state.met.includes(id)) return false;
    this.state.met = [...this.state.met, id];
    this.persist();
    return true;
  }
  bottle(id: string) {
    if (this.state.bottles.includes(id)) return false;
    this.state.bottles = [...this.state.bottles, id];
    this.persist();
    return true;
  }
  flag(k: 'golden' | 'finale' | 'walked' | 'splashed') {
    if (this.state[k]) return false;
    this.state[k] = true;
    this.persist();
    return true;
  }
  jump() {
    this.state.jumps++;
    if (this.state.jumps <= 25) this.persist();
  }
  score(game: 'memoryBest' | 'dropBest', value: number, better: 'higher' | 'lower' = 'higher') {
    const cur = this.state[game];
    const improved = !cur || (better === 'higher' ? value > cur : value < cur);
    if (improved) this.state[game] = value;
    if (game === 'memoryBest' && value > 0) this.unlock('memory');
    if (game === 'dropBest' && value >= 300) this.unlock('arcade');
    this.persist();
    return improved;
  }

  get xp() {
    const s = this.state;
    return (
      this.collection.length * 100 +
      s.sprinkles.length * 5 +
      s.met.length * 25 +
      Math.min(s.bottles.length, 10) * 20 +
      (s.golden ? 150 : 0) +
      (s.finale ? 100 : 0) +
      s.trophies.length * 10
    );
  }
  get rank() {
    const xp = this.xp;
    let idx = 0;
    RANKS.forEach((r, i) => {
      if (xp >= r.xp) idx = i;
    });
    const next = RANKS[idx + 1];
    const from = RANKS[idx].xp;
    return { ...RANKS[idx], level: idx + 1, next, pct: next ? (xp - from) / (next.xp - from) : 1 };
  }

  unlock(id: string) {
    if (this.state.trophies.includes(id)) return;
    const t = TROPHIES.find((x) => x.id === id);
    if (!t) return;
    this.state.trophies = [...this.state.trophies, id];
    save('ddi-island-progress', this.state);
    this.trophyFns.forEach((fn) => fn(t));
  }

  private checkTrophies() {
    const s = this.state;
    if (s.walked) this.unlock('first-steps');
    if (s.sprinkles.length >= 1) this.unlock('sweet-tooth');
    if (s.sprinkles.length >= SPRINKLE_TOTAL) this.unlock('sprinkles');
    if (s.met.length >= 3) this.unlock('social');
    if (s.bottles.length >= 1) this.unlock('bottle');
    if (s.splashed) this.unlock('splash');
    if (s.jumps >= 25) this.unlock('hops');
    if (this.collection.length >= 6) this.unlock('explorer');
    if (s.golden) this.unlock('golden');
    if (s.finale) this.unlock('finale');
  }

  reset() {
    this.collection = [];
    this.state = { ...EMPTY };
    remove('ddi-island-pos');
    this.persist();
  }
}

export const progress = new Progress();

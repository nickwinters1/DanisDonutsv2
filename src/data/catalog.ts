/* The island's fixed content: destinations, decorations and attractions.
 * Keys must match the database constraints in supabase/upgrade.sql. */
import type { CardStyle, Category, Frosting, Gem, Region, SprinkleStyle } from './types';

export interface Zone {
  id: Category;
  icon: string;
  name: string;
  short: string;
  sub: string;
  desc: string;
  color: string;
  accent: string;
  treasure: string;
  treasureName: string;
  prompt: string;
  /** Which attraction opens when you visit this stop on the island. */
  action: AttractionId;
}

export const ZONES: Zone[] = [
  {
    id: 'note',
    icon: '🍩',
    name: 'The Donut Shop',
    short: 'Donut Shop',
    sub: 'Love notes & birthday wishes',
    desc: 'A display case filled with the sweetest messages from the Donuts.',
    color: '#fce2e9',
    accent: '#e57fa1',
    treasure: '🍩',
    treasureName: 'Strawberry Donut',
    prompt: 'What makes Dani special to you?',
    action: 'donuts',
  },
  {
    id: 'memory',
    icon: '🌴',
    name: 'Memory Beach',
    short: 'Memory Beach',
    sub: 'Photos & little moments',
    desc: 'Postcards from favorite streams, community moments and friendships.',
    color: '#e5f4ed',
    accent: '#5fb894',
    treasure: '🐚',
    treasureName: 'Memory Shell',
    prompt: 'Tell us about a memory you’ll always keep.',
    action: 'diary',
  },
  {
    id: 'clip',
    icon: '🎮',
    name: 'Victory Arcade',
    short: 'Arcade',
    sub: 'Clips & gaming adventures',
    desc: 'Iconic Fortnite moments, funny fails and unforgettable stream highlights.',
    color: '#e8e4fb',
    accent: '#8c7be0',
    treasure: '🎮',
    treasureName: 'Victory Controller',
    prompt: 'Share a favorite stream clip or gaming story.',
    action: 'arcade',
  },
  {
    id: 'card',
    icon: '🌟',
    name: 'Collector’s Corner',
    short: 'Card Shop',
    sub: 'Fan art & community cards',
    desc: 'A little collection of trading-card-inspired tributes, fan art and favorites.',
    color: '#fff0d7',
    accent: '#e7b04f',
    treasure: '⭐',
    treasureName: 'Collector Star',
    prompt: 'Describe your fan art, dream collectible or favorite Pokémon memory.',
    action: 'packs',
  },
  {
    id: 'letter',
    icon: '💎',
    name: 'Crystal Cove',
    short: 'Crystal Cove',
    sub: 'Open-when letters',
    desc: 'Gentle words and small reminders for days that need a little extra sparkle.',
    color: '#efe3f9',
    accent: '#a184e0',
    treasure: '💎',
    treasureName: 'Kindness Crystal',
    prompt: 'Write a letter for a moment Dani might need encouragement.',
    action: 'crystals',
  },
  {
    id: 'capsule',
    icon: '🗝️',
    name: 'The Treasure Chest',
    short: 'Treasure',
    sub: 'Wishes for the future',
    desc: 'Little hopes, dreams and wishes for the next chapter of her adventure.',
    color: '#f9e8db',
    accent: '#d69a5f',
    treasure: '🗝️',
    treasureName: 'Golden Key',
    prompt: 'What do you hope the next year brings Dani?',
    action: 'capsule',
  },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id) ?? ZONES[0];

export type AttractionId =
  | 'donuts'
  | 'crystals'
  | 'packs'
  | 'cinema'
  | 'worldmap'
  | 'diary'
  | 'finale'
  | 'game'
  | 'arcade'
  | 'capsule'
  | 'drop';

export interface Attraction {
  id: AttractionId;
  icon: string;
  name: string;
  desc: string;
  color: string;
}

export const ATTRACTIONS: Attraction[] = [
  { id: 'donuts', icon: 'donut', name: 'Community Donut Box', desc: 'Decorate a donut and make it part of Dani’s gift.', color: '#fce3eb' },
  { id: 'crystals', icon: 'crystal', name: 'Crystal of Kindness', desc: 'A growing collection of encouraging words.', color: '#efe2fa' },
  { id: 'packs', icon: 'cards', name: 'Community Booster Packs', desc: 'Open original community trading cards.', color: '#fff0d7' },
  { id: 'cinema', icon: 'film', name: 'Sunset Cinema', desc: 'Watch the community’s clips and video memories.', color: '#e9e0f5' },
  { id: 'worldmap', icon: 'globe', name: 'Donuts Around the World', desc: 'Discover how far the community reaches.', color: '#def2ec' },
  { id: 'diary', icon: 'diary', name: 'Donut Diaries', desc: 'An evolving scrapbook across celebrations.', color: '#f9e9de' },
  { id: 'finale', icon: 'gift', name: 'The Grand Finale', desc: 'Unlock a little surprise after all six quests.', color: '#fde1ed' },
  { id: 'game', icon: 'sprinkles', name: 'Sprinkle Hunt', desc: 'A quick memory game between adventures.', color: '#e5e7fa' },
  { id: 'drop', icon: 'gamepad', name: 'Donut Drop', desc: 'A 60-second arcade dash. Catch donuts, dodge the seagulls.', color: '#e3f1fb' },
];

export const FROSTINGS: Record<Frosting, { label: string; color: string; shade: string }> = {
  strawberry: { label: 'Strawberry', color: '#f39db9', shade: '#e07397' },
  blueberry: { label: 'Blueberry', color: '#a7a0e5', shade: '#8279cf' },
  chocolate: { label: 'Chocolate', color: '#a77563', shade: '#7f5243' },
  vanilla: { label: 'Vanilla', color: '#fff0cb', shade: '#ecd59c' },
  ocean: { label: 'Ocean', color: '#87d5d0', shade: '#5bbab4' },
  rainbow: { label: 'Lavender', color: '#d1b1e8', shade: '#b48fd6' },
};

export const SPRINKLES: Record<SprinkleStyle, string> = {
  rainbow: 'Rainbow sprinkles',
  stars: 'Star sprinkles',
  hearts: 'Heart sprinkles',
  plain: 'No sprinkles',
};

export const GEMS: Record<Gem, { label: string; color: string; light: string; deep: string }> = {
  amethyst: { label: 'Amethyst', color: '#ac91e3', light: '#e6dcff', deep: '#7c62c4' },
  rose: { label: 'Rose quartz', color: '#ed9fbd', light: '#ffe1ec', deep: '#d06f96' },
  aqua: { label: 'Aquamarine', color: '#8bd1d7', light: '#dcf7f7', deep: '#57aab2' },
  citrine: { label: 'Citrine', color: '#efc46f', light: '#fff1cf', deep: '#cf9b3c' },
  emerald: { label: 'Emerald', color: '#85c8a0', light: '#dcf3e4', deep: '#559d73' },
};

/** [label, x%, y%] — the pin position on the stylized world map. */
export const REGIONS: Record<Region, { label: string; x: number; y: number }> = {
  na: { label: 'North America', x: 20, y: 35 },
  sa: { label: 'South America', x: 31, y: 70 },
  eu: { label: 'Europe', x: 51, y: 29 },
  af: { label: 'Africa', x: 52, y: 57 },
  as: { label: 'Asia', x: 73, y: 38 },
  oc: { label: 'Oceania', x: 86, y: 76 },
};

export const CARD_STYLES: Record<CardStyle, { label: string; icon: string; rarity: string; from: string; to: string; ink: string }> = {
  gaming: { label: 'Victory', icon: '🎮', rarity: 'Epic', from: '#cfc4fb', to: '#f6c6dc', ink: '#5a3f8f' },
  friendship: { label: 'Friendship', icon: '♡', rarity: 'Rare', from: '#ffd1de', to: '#ffe9c9', ink: '#9a4d6b' },
  donut: { label: 'Sweetness', icon: '🍩', rarity: 'Rare', from: '#ffd6e3', to: '#fbe7ff', ink: '#97506f' },
  crystal: { label: 'Magic', icon: '💎', rarity: 'Holo', from: '#d9cdfd', to: '#c8f0f2', ink: '#5d4aa0' },
  beach: { label: 'Sunshine', icon: '🌴', rarity: 'Uncommon', from: '#c9efe3', to: '#fff1c6', ink: '#3f7d68' },
  collector: { label: 'Collector', icon: '⭐', rarity: 'Legendary', from: '#ffe9a8', to: '#ffd0e0', ink: '#8a6420' },
};

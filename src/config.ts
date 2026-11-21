/* Everything you might want to change lives here. */

/** Supabase PUBLIC settings, injected at build time (see README → "Connect the shared island").
 *  Leave them empty and the island runs in Preview Mode (everything stays in this browser). */
const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** Refuse anything that looks like a secret key: it must never ship in a public website. */
function looksSecret(k: string) {
  if (k.startsWith('sb_secret_')) return true;
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

export const SECRET_KEY_BLOCKED = !!key && looksSecret(key);
if (SECRET_KEY_BLOCKED) {
  console.error(
    "Dani's Donut Island: the configured Supabase key is a SECRET / service-role key. It was ignored. " +
      'Use the public anon or publishable key, and rotate the secret key in Supabase now.',
  );
}

export const CONFIG = {
  url: SECRET_KEY_BLOCKED ? '' : url.replace(/\/$/, ''),
  key: SECRET_KEY_BLOCKED ? '' : key,
};

export const DEMO = !(CONFIG.url && CONFIG.key);

export const SITE = {
  /** Who the island is for. Used in a few headlines. */
  name: 'Dani',
  community: 'Dani’s Donuts',
  links: [
    { label: 'Twitch', href: 'https://www.twitch.tv/heydani' },
    { label: 'Merch', href: 'https://heydani-shop.fourthwall.com/' },
    { label: 'Instagram', href: 'https://www.instagram.com/heydani' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@itsheydani' },
  ],
  /** The letter that opens with the grand finale. Make it yours. */
  finaleLetter: [
    'What started as a little corner of the internet became something so much more. Because of you, strangers became friends, ordinary nights became memories, and people from completely different places found something in common.',
    'We hope this little island reminds you of the laughter, happiness and friendships you’ve helped create. Every donut, crystal, card and letter is a little piece of that story.',
  ],
};

/** How often an open page checks whether the organizers opened the surprise (live mode). */
export const POLL_EVENT_MS = 30_000;
/** A tiny "how many notes are public?" check; the full list is only re-downloaded when it changes. */
export const POLL_COUNT_MS = 45_000;
/** Safety net: re-download everything this often anyway. */
export const POLL_MESSAGES_MS = 600_000;

/**
 * 🌐 The live island's PUBLIC settings: the only file to edit to go live.
 *
 * • Leave the two Supabase values empty and the island runs in Preview Mode
 *   (labeled examples; anything people send stays in their own browser).
 * • Fill them in and the island becomes the real, shared one: everyone's notes are saved,
 *   the examples disappear, and organizers can approve, hide and delete notes.
 *
 * These values are safe to publish. The Project URL and the publishable (or "anon public") key
 * are meant to sit in a website's code; the database rules (RLS) are what protect the notes.
 * NEVER put a secret key (sb_secret_…) or the service_role key here. The site refuses them anyway.
 *
 * On GitHub: open this file, click the ✏️ pencil, paste the values between the quotes, then
 * click "Commit changes". The site rebuilds itself in about a minute.
 * (GitHub Actions variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SITE_URL, if you
 * ever set them, take priority over this file.)
 */
export const LIVE = {
  /** Supabase → Project Settings → Data API → Project URL, e.g. 'https://abcdefghijklmnop.supabase.co' */
  supabaseUrl: 'https://frhnadwefaltfvsugsrz.supabase.co',
  /** Supabase → Project Settings → API Keys → Publishable key ('sb_publishable_…'), or the legacy "anon public" key */
  supabaseKey: 'sb_publishable_9kMFv4fkqdy5Vj0L5VkDqg_7pEns1Wz',
  /** The site's address, used for link previews (Discord, X, iMessage…). */
  siteUrl: 'https://heydanidonuts.com/',
};

// 🍩 Launch check for Dani's Donut Island
//
// Runs on GitHub's servers after every deploy, every 3 days, and whenever someone clicks
// Actions → "Check the live site" → Run workflow. It only reads public things: the website,
// the OBS overlay, and what any visitor's browser is allowed to ask the database.
// Results appear on the run's Summary page. ❌ fails the run; ⚠️ is a to-do; ℹ️ is just info.
import { appendFileSync, readFileSync } from 'node:fs';

const env = process.env;
const [owner, repo] = (env.GITHUB_REPOSITORY || 'nickwinters1/DanisDonutsv2').split('/');
const lines = [];
let failed = false;
let todos = 0;
const ok = (m) => lines.push(`✅ ${m}`);
const info = (m) => lines.push(`ℹ️ ${m}`);
const warn = (m) => {
  todos++;
  lines.push(`⚠️ ${m}`);
};
const bad = (m) => {
  failed = true;
  lines.push(`❌ ${m}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bust = (u) => `${u}${u.includes('?') ? '&' : '?'}launch-check=${Date.now()}`;
const clean = (u) => u.replace(/[?&]launch-check=\d+/, '');
async function tryGet(url, init = {}) {
  try {
    return await fetch(url, { redirect: 'follow', ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    return null;
  }
}

// ── What the site is built with: GitHub variables win over src/live-settings.ts (same as the build) ──
const file = readFileSync(new URL('../../src/live-settings.ts', import.meta.url), 'utf8');
const fromFile = (k) => file.match(new RegExp(`\\b${k}:\\s*'([^']*)'`))?.[1].trim() ?? '';
const supabaseUrl = (env.VITE_SUPABASE_URL || fromFile('supabaseUrl')).trim().replace(/\/+$/, '');
const supabaseKey = (env.VITE_SUPABASE_ANON_KEY || fromFile('supabaseKey')).trim();
const dbOrigin = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).origin : '';
  } catch {
    return '';
  }
})();

// ── Where does the site live? GitHub Pages knows about a custom domain ──
const githubIo = `https://${owner.toLowerCase()}.github.io/${repo}/`;
let pages = null;
if (env.GITHUB_TOKEN) {
  const r = await tryGet(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
  });
  if (r?.ok) pages = await r.json();
}
const domain = (pages?.cname || '').toLowerCase();

/** Load the island, retrying for a while: a fresh deploy can take a minute to reach every server. */
async function loadIsland(url, tries) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const r = await tryGet(bust(url));
    if (r?.ok) {
      const html = await r.text();
      if (html.includes('Donut')) {
        last = { url: clean(r.url), html };
        const built = builtDatabase(html);
        if (!dbOrigin || built === dbOrigin) return last; // up to date
      }
    }
    if (i < tries - 1) await sleep(15_000);
  }
  return last;
}
function builtDatabase(html) {
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)?.[1] ?? '';
  const connect = csp.match(/connect-src ([^;]*)/)?.[1] ?? '';
  return connect.split(/\s+/).find((s) => /^https?:\/\//.test(s)) ?? '';
}

// ── 1 · The website ──
let page = null;
if (env.CHECK_SITE_URL) page = await loadIsland(env.CHECK_SITE_URL, 2);
else if (domain) {
  page = await loadIsland(`https://${domain}/`, 4);
  if (!page) {
    const plain = await tryGet(bust(`http://${domain}/`));
    if (plain?.ok && (await plain.text()).includes('Donut')) {
      warn(`http://${domain} works, but the secure https:// version isn't ready yet. GitHub issues the certificate automatically once DNS is right; check back in a little while.`);
    } else {
      warn(
        `${domain} isn't reaching the island yet. DNS changes can take up to 24 hours. Meanwhile, double-check the DNS records (GO-LIVE.md → Part 5) and remove any old parking or forwarding records.`,
      );
    }
  }
} else {
  page = await loadIsland(githubIo, 4);
  if (!page) bad(`The island didn't load at ${githubIo}. Open Actions → "Deploy to GitHub Pages" and check the latest run.`);
}

if (page) {
  ok(`The island is up at ${page.url}`);
  const overlayUrl = new URL('obs-overlay.html', page.url).href;
  const ov = await tryGet(bust(overlayUrl));
  if (ov?.ok) ok(`The OBS overlay is up at ${overlayUrl}`);
  else bad(`The OBS overlay didn't load at ${overlayUrl} (${ov ? `HTTP ${ov.status}` : 'no answer'}).`);

  const built = builtDatabase(page.html);
  if (dbOrigin && built === dbOrigin) ok('The live site is connected to the database: everyone shares one island, and there are no example notes.');
  else if (dbOrigin) bad(`The live site isn't using the database yet (it was built ${built ? `for ${built}` : 'in Preview Mode'}). Re-run Actions → "Deploy to GitHub Pages".`);
  else if (built) info(`The live site is built for the database at ${built}.`);

  const ogUrl = page.html.match(/<meta property="og:url" content="([^"]*)"/)?.[1] ?? '';
  if (domain && !ogUrl.includes(domain)) warn(`Link previews (Discord, X…) still point to ${ogUrl}. Set siteUrl in src/live-settings.ts to 'https://${domain}/'.`);
}

// ── 2 · The database ──
function isSecret(k) {
  if (k.startsWith('sb_secret_')) return true;
  const p = k.split('.');
  if (p.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(p[1], 'base64url').toString()).role === 'service_role';
  } catch {
    return false;
  }
}

if (!supabaseUrl && !supabaseKey) {
  info('Preview Mode: no database connected yet, so notes stay in each visitor’s own browser. To go live, fill in src/live-settings.ts (GO-LIVE.md → Part 3).');
} else if (supabaseKey && isSecret(supabaseKey)) {
  bad(
    '🚨 The configured Supabase key is a SECRET key (full access to the database). The site refuses to use it, but it is now public in this repository: in Supabase → Project Settings → API Keys, delete/roll that secret key right away, then use the publishable key instead.',
  );
} else if (!dbOrigin || /supabase\.com$/i.test(new URL(dbOrigin).hostname)) {
  bad(`supabaseUrl should be the Project URL, like https://abcdefghijklmnop.supabase.co (got "${supabaseUrl}"). The supabase.com dashboard link won't work.`);
} else if (!supabaseKey) {
  bad('supabaseUrl is set but supabaseKey is empty. Add the publishable key (sb_publishable_…) to src/live-settings.ts.');
} else {
  const h = { apikey: supabaseKey, ...(supabaseKey.split('.').length === 3 ? { authorization: `Bearer ${supabaseKey}` } : {}) };
  const r = await tryGet(`${supabaseUrl}/rest/v1/island_event?select=id,title,revealed,finale_token`, { headers: h });
  const body = r ? await r.json().catch(() => null) : null;
  const event = r?.ok && Array.isArray(body) ? body[0] : null;
  if (!r) {
    bad(`Couldn't reach the database at ${supabaseUrl}. Check the Project URL. If the Supabase project was paused, open supabase.com and click Restore project.`);
  } else if (event) {
    ok(`Database connected and set up. Edition: “${event.title}”.`);
    if (event.revealed) ok('The surprise is OPEN: approved public notes are visible to everyone.');
    else info('The surprise is sealed: people can leave notes, and they stay hidden until you tick “Open the surprise” in the Organizer dashboard.');

    if (event.revealed) {
      const c = await tryGet(
        `${supabaseUrl}/rest/v1/island_messages?select=id&event_id=eq.${encodeURIComponent(event.id)}&status=eq.approved&visibility=eq.public`,
        { method: 'HEAD', headers: { ...h, prefer: 'count=exact' } },
      );
      const total = c?.ok ? c.headers.get('content-range')?.split('/')[1] : undefined;
      if (total !== undefined && total !== '*') info(`${total} approved public note${total === '1' ? '' : 's'} on the island right now.`);
      else bad(`Couldn't count the public notes (${c ? `HTTP ${c.status}` : 'no answer'}).`);
    }
    const a = await tryGet(`${supabaseUrl}/rest/v1/island_archives?select=id&limit=1`, { headers: h });
    if (!a?.ok) bad('The diary table (island_archives) is missing. In Supabase → SQL Editor, run supabase/upgrade.sql.');

    const s = await tryGet(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
    const auth = s?.ok ? await s.json().catch(() => null) : null;
    if (auth?.disable_signup === true) ok('Public sign-ups are off: only organizer logins you create can sign in.');
    else if (auth?.disable_signup === false)
      warn('Public sign-ups are still on. Visitors never need accounts: in Supabase → Authentication → Sign In / Providers, switch off “Allow new users to sign up” and click Save.');
  } else if (r.ok) {
    bad('The database is set up but the edition row is missing from island_event.');
  } else if (r.status === 401 || r.status === 403) {
    bad('The database refused the key. Use the publishable key (sb_publishable_…) or the legacy “anon public” key.');
  } else if (body?.code === 'PGRST205' || body?.code === '42P01' || r.status === 404) {
    bad('The database is reachable, but the island’s tables are missing. In Supabase → SQL Editor, run supabase/one-step-setup.sql.');
  } else if (body?.code === '42703') {
    bad('The database is only half set up. In Supabase → SQL Editor, run supabase/upgrade.sql.');
  } else {
    bad(`The database answered HTTP ${r.status}${body?.message ? `: ${body.message}` : ''}. If the project is paused, open supabase.com and click Restore project.`);
  }
}

// ── 3 · Your own domain ──
if (domain) {
  if (pages.https_enforced) ok('“Enforce HTTPS” is on.');
  else warn('Tick “Enforce HTTPS” in Settings → Pages (it becomes clickable once GitHub has issued the certificate).');
  if (!domain.startsWith('www.')) {
    const w = await tryGet(bust(`https://www.${domain}/`));
    if (w?.ok) ok(`www.${domain} works too.`);
    else info(`www.${domain} doesn't work yet (DNS record: CNAME www → ${owner.toLowerCase()}.github.io).`);
  }
} else if (pages) {
  info(`No custom domain yet: the island lives at ${githubIo}`);
}

// ── Report ──
const title = failed ? '❌ Launch check: something needs attention' : todos ? '🍩 Launch check: up and running, with a few to-dos' : '🍩 Launch check: all good';
const md = [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''].join('\n');
console.log(md);
for (const l of lines) {
  if (l.startsWith('❌')) console.log(`::error title=Launch check::${l.slice(2).trim()}`);
  if (l.startsWith('⚠️')) console.log(`::warning title=Launch check::${l.slice(2).trim()}`);
}
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md + '\n');
process.exit(failed ? 1 : 0);

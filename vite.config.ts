import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Production-only hardening + share previews:
 *  • a Content-Security-Policy that only allows this site, the configured Supabase project
 *    and youtube-nocookie embeds (defence in depth: every message is escaped anyway)
 *  • absolute og:image / og:url so link previews work on Discord, X, iMessage… */
function islandHtml(env: Record<string, string>): Plugin {
  const supabase = (() => {
    try {
      return env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : '';
    } catch {
      return '';
    }
  })();
  const site = (env.SITE_URL || 'https://nickwinters1.github.io/DanisDonutsv2/').replace(/\/?$/, '/');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${supabase ? ' ' + supabase : ''}`,
    'frame-src https://www.youtube-nocookie.com',
    'media-src https: blob:',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'island-html',
    apply: 'build',
    transformIndexHtml(html) {
      return html
        .replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
        .replace('<meta property="og:image" content="./og.jpg" />', `<meta property="og:image" content="${site}og.jpg" />\n    <meta property="og:url" content="${site}" />`);
    },
  };
}

// Two pages: the island itself and the transparent OBS overlay.
// `base: './'` keeps every asset path relative, so the build works on a GitHub Pages
// project site (/DanisDonutsv2/), Netlify, Cloudflare Pages or any sub-folder.
export default defineConfig(({ mode }) => {
  // loadEnv with an empty prefix also picks up real environment variables (GitHub Actions)
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [islandHtml(env)],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1400,
      rolldownOptions: {
        input: {
          main: 'index.html',
          overlay: 'obs-overlay.html',
        },
      },
    },
    server: { host: true },
  };
});

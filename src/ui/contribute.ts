/* "Leave a little sweetness": the contribution form, with a live preview of the Donut that
 * will hop around the island for you. Same fields + rules as the original island. */
import { CARD_STYLES, FROSTINGS, GEMS, REGIONS, SPRINKLES, ZONES, zoneById } from '../data/catalog';
import { safeURL, store } from '../data/store';
import type { CardStyle, Category, Frosting, Gem, Meta, NewMessage, Region, SprinkleStyle } from '../data/types';
import { crystalSVG, donutSVG, styleFor } from '../art/art';
import { get, remove, save } from '../lib/storage';
import { sound } from '../lib/sound';
import { esc, html, raw } from './dom';
import { openDialog } from './dialog';
import { toast } from './toast';

interface Draft {
  author?: string;
  title?: string;
  body?: string;
  link?: string;
  frosting?: Frosting;
  sprinkles?: SprinkleStyle;
}

const swatches = <K extends string>(name: string, entries: [K, string, string][], chosen: K | '', label: string) =>
  `<fieldset class="field"><legend>${esc(label)}</legend><div class="swatches" role="radiogroup" aria-label="${esc(label)}">${entries
    .map(
      ([k, title, art]) =>
        `<label class="swatch" title="${esc(title)}"><input type="radio" name="${name}" value="${k}" ${k === chosen ? 'checked' : ''}><span class="sw-art">${art}</span><span class="sw-name">${esc(title)}</span></label>`,
    )
    .join('')}</div></fieldset>`;

export function contribute(category: Category = 'note') {
  if (store.loadError) {
    toast('The shared island is unavailable right now.', { icon: '🌧️' });
    return;
  }
  const z = zoneById(category);
  const draft = get<Draft>('ddi-draft', {});
  const auto = styleFor(draft.author || String(Math.random()));
  let frosting: Frosting = draft.frosting ?? auto.frosting;
  let sprinkles: SprinkleStyle = draft.sprinkles ?? auto.sprinkles;
  const lead = store.demo
    ? 'This is the local preview. Your test note stays on this device and won’t reach anyone else yet.'
    : 'Your note goes to the organizers for review before it can appear on the island.';
  openDialog(
    'Leave a little sweetness',
    html`<p class="dialog-lead">Write something for Dani. ${lead}</p>
      <form id="contribution" class="contribute" novalidate>
        <div class="contribute-grid">
          <div class="contribute-main">
            <div class="formgrid">
              <div class="field"><label for="author">Twitch name or nickname</label><input id="author" name="author" maxlength="60" placeholder="Anonymous Donut" autocomplete="nickname" value="${draft.author ?? ''}"></div>
              <div class="field"><label for="category">Island destination</label><select id="category" name="category">${raw(
                ZONES.map((x) => `<option value="${x.id}" ${x.id === z.id ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join(''),
              )}</select></div>
            </div>
            <div class="field"><label for="title">A little title</label><input id="title" name="title" maxlength="100" placeholder="e.g. My favorite moment" value="${draft.title ?? ''}"></div>
            <div class="field"><label for="body">Your message *</label><textarea id="body" name="body" required maxlength="2500" placeholder="${z.prompt}">${draft.body ?? ''}</textarea><span class="count" id="body-count">0 / 2500</span></div>
            <div class="field"><label for="link">Optional photo, video, fan art or clip link</label><input id="link" name="link" type="url" inputmode="url" maxlength="500" placeholder="https://…" value="${draft.link ?? ''}"><p class="hint">Use a link you have permission to share. No direct uploads. Check its sharing permissions.</p></div>
            <div id="extra-fields"></div>
          </div>
          <aside class="contribute-preview" aria-live="polite">
            <p class="subhead">Your Donut on the island</p>
            <div class="pv-stage"><div class="pv-donut" id="pv-donut"></div><span class="pv-name" id="pv-name">Anonymous Donut</span></div>
            <p class="pv-title" id="pv-title">A little note</p>
            <p class="hint">Public notes become a little Donut friend who hops around the island. Players can walk up and read yours.</p>
          </aside>
        </div>
        <div id="avatar-fields"></div>
        <fieldset class="field"><legend>Optional world map region (continent only)</legend>
          <div class="regions" role="radiogroup" aria-label="World map region">
            <label class="chipradio"><input type="radio" name="region" value="" checked><span>Prefer not to share</span></label>
            ${raw(Object.entries(REGIONS).map(([k, r]) => `<label class="chipradio"><input type="radio" name="region" value="${k}"><span>${esc(r.label)}</span></label>`).join(''))}
          </div>
          <p class="hint">If you choose a public message, this region appears on the community map. No exact locations.</p>
        </fieldset>
        <div class="field"><label for="visibility">Who can see it?</label><select name="visibility" id="visibility"><option value="public">Okay to share on stream and the public island</option><option value="private">Private: organizers deliver it to Dani separately</option></select></div>
        <label class="check"><input name="consent" type="checkbox" required> I agree to the visibility choice above and have permission to share anything I include. No sensitive personal information, please.</label>
        <input name="website" type="text" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">
        <div class="actions"><button class="btn big" type="submit">Send with love ♡</button><button class="btn light" type="button" data-close>Cancel</button></div>
        <div id="form-status" class="status" role="status"></div>
      </form>`,
    { variant: 'wide form', icon: '✉️', key: 'contribute' },
  );

  const form = document.getElementById('contribution') as HTMLFormElement;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const catSel = $<HTMLSelectElement>('category');
  const body = $<HTMLTextAreaElement>('body');
  let touchedStyle = !!draft.frosting;

  const renderAvatar = () => {
    $('avatar-fields').innerHTML =
      swatches(
        'frosting',
        (Object.keys(FROSTINGS) as Frosting[]).map((k) => [k, FROSTINGS[k].label, donutSVG({ frosting: k, sprinkles: 'plain', seed: k })]),
        frosting,
        'Your donut frosting',
      ) +
      swatches(
        'sprinkles',
        (Object.keys(SPRINKLES) as SprinkleStyle[]).map((k) => [k, SPRINKLES[k], donutSVG({ frosting, sprinkles: k, seed: 'sp' + k })]),
        sprinkles,
        'Decoration',
      );
  };
  const renderExtra = (cat: Category) => {
    const el = $('extra-fields');
    if (cat === 'letter')
      el.innerHTML = swatches(
        'crystal',
        (Object.keys(GEMS) as Gem[]).map((k) => [k, GEMS[k].label, crystalSVG(k)]),
        'amethyst',
        'Choose a crystal for this letter',
      );
    else if (cat === 'card')
      el.innerHTML =
        swatches(
          'cardStyle',
          (Object.keys(CARD_STYLES) as CardStyle[]).map((k) => {
            const c = CARD_STYLES[k];
            return [k, c.label, `<span class="mini-card" style="--a:${c.from};--b:${c.to}">${c.icon}</span>`];
          }),
          'friendship',
          'Your trading card theme',
        ) + '<p class="hint">The title becomes the card name; your message becomes its story.</p>';
    else el.innerHTML = '';
  };
  const preview = () => {
    const name = ($<HTMLInputElement>('author').value.trim() || 'Anonymous Donut').slice(0, 60);
    if (!touchedStyle) {
      const s = styleFor(name);
      frosting = s.frosting;
      sprinkles = s.sprinkles;
    }
    $('pv-donut').innerHTML = donutSVG({ frosting, sprinkles, seed: name, face: true });
    $('pv-name').textContent = name;
    $('pv-title').textContent = $<HTMLInputElement>('title').value.trim() || 'A little note';
    $('body-count').textContent = `${body.value.length} / 2500`;
  };
  const persist = () =>
    save('ddi-draft', {
      author: $<HTMLInputElement>('author').value,
      title: $<HTMLInputElement>('title').value,
      body: body.value,
      link: $<HTMLInputElement>('link').value,
      frosting: touchedStyle ? frosting : undefined,
      sprinkles: touchedStyle ? sprinkles : undefined,
    } satisfies Draft);

  preview();
  renderAvatar();
  renderExtra(z.id);
  catSel.onchange = () => {
    body.placeholder = zoneById(catSel.value).prompt;
    renderExtra(catSel.value as Category);
  };
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'frosting' || t.name === 'sprinkles') {
      touchedStyle = true;
      if (t.name === 'frosting') frosting = t.value as Frosting;
      else sprinkles = t.value as SprinkleStyle;
      if (t.name === 'frosting') renderAvatar();
      sound.click();
    }
    if (t.name === 'author' && !touchedStyle) {
      preview();
      renderAvatar();
    }
    preview();
    persist();
  });
  form.onsubmit = (e) => submit(e, form);
  setTimeout(() => (draft.body ? body : $<HTMLInputElement>('author')).focus(), 60);
}

async function submit(e: Event, f: HTMLFormElement) {
  e.preventDefault();
  const fd = new FormData(f);
  const status = document.getElementById('form-status')!;
  status.classList.remove('error');
  if (fd.get('website')) return; // honeypot: bots fill hidden fields
  const meta: Meta = {};
  const pick = <T extends string>(k: keyof Meta, allowed: Record<T, unknown>) => {
    const v = String(fd.get(k) ?? '');
    if (Object.hasOwn(allowed, v)) (meta as Record<string, string>)[k] = v;
  };
  pick('frosting', FROSTINGS);
  pick('sprinkles', SPRINKLES);
  pick('crystal', GEMS);
  pick('cardStyle', CARD_STYLES);
  pick('region', REGIONS as Record<Region, unknown>);
  const data: NewMessage = {
    meta,
    event_id: store.event.id,
    category: String(fd.get('category')) as Category,
    author: String(fd.get('author') ?? '').trim() || 'Anonymous Donut',
    title: String(fd.get('title') ?? '').trim(),
    body: String(fd.get('body') ?? '').trim(),
    link: String(fd.get('link') ?? '').trim() || null,
    visibility: fd.get('visibility') === 'private' ? 'private' : 'public',
  };
  if (!data.body) {
    status.textContent = 'Please write a message first ♡';
    status.classList.add('error');
    (f.querySelector('#body') as HTMLElement).focus();
    return;
  }
  if (data.link && !safeURL(data.link)) {
    status.textContent = 'Links need to start with https:// so they’re safe to open.';
    status.classList.add('error');
    (f.querySelector('#link') as HTMLElement).focus();
    return;
  }
  if (!fd.get('consent')) {
    status.textContent = 'Please tick the consent box so we know it’s okay to share.';
    status.classList.add('error');
    return;
  }
  const btn = f.querySelector<HTMLButtonElement>('[type=submit]')!;
  btn.disabled = true;
  status.textContent = 'Sending…';
  try {
    await store.submit(data);
    remove('ddi-draft');
    sound.success();
    const s = styleFor(data.author, meta.frosting, meta.sprinkles);
    openDialog(
      'You made the island sweeter! 🍩',
      html`<div class="thanks">
        <div class="thanks-donut">${raw(donutSVG({ ...s, seed: data.author, face: true }))}</div>
        <p>${
          store.demo
            ? 'Your test message is stored on this device. Open Organizer at the bottom of the page to approve it and test the reveal.'
            : 'Your message has been sent to the organizers for review. Thank you for being part of Dani’s Donuts!'
        }</p>
        ${data.visibility === 'public' ? html`<p class="hint">Once it’s approved and the surprise opens, your Donut will be hopping around the island.</p>` : html`<p class="hint">Private notes stay with the organizers and are delivered to Dani separately.</p>`}
      </div>
      <div class="actions dialog-actions"><button type="button" class="btn" data-close>Back to the island</button><button type="button" class="btn light" data-contribute>Write another</button></div>`,
      { icon: '💌', key: 'thanks' },
    );
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : String(err);
    status.classList.add('error');
    btn.disabled = false;
  }
}

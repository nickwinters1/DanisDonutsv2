/* The island's data: the current edition, its public messages, and every organizer action.
 * Preview Mode (no Supabase configured) keeps everything in this browser's localStorage,
 * exactly like the original single-file island. Live mode talks to Supabase, where
 * Row Level Security decides what anyone can read or write. */
import { DEMO, POLL_COUNT_MS, POLL_EVENT_MS, POLL_MESSAGES_MS } from '../config';
import { get, save } from '../lib/storage';
import { api, apiCount, ApiError } from './api';
import { SAMPLES } from './samples';
import type { Archive, IslandEvent, Message, NewMessage, Session, Status } from './types';

const DEMO_EVENT: IslandEvent = { id: 'preview', title: 'A celebration for Dani', revealed: true };
const EVENT_FIELDS = 'id,title,revealed,finale_token';

type Listener = () => void;

export function safeURL(v: unknown): string {
  try {
    const u = new URL(String(v ?? ''));
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

class Store {
  event: IslandEvent = DEMO_EVENT;
  messages: Message[] = [];
  loadError = '';
  loaded = false;

  /* Preview-mode storage (same keys as the original island, so a local test carries over). */
  demoRows: Message[] = get<Message[]>('ddi-messages', []);
  demoSettings: IslandEvent = get<IslandEvent>('ddi-event', DEMO_EVENT);
  archiveLocal: Archive[] = get<Archive[]>('ddi-ultimate-archives', []);

  /* Organizer state lives in memory only: reloading signs out. */
  session: Session | null = null;
  admin = false;
  organizerRows: Message[] = [];

  private listeners = new Set<Listener>();
  private revealListeners = new Set<Listener>();
  private pollTimers: number[] = [];

  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Fires when the surprise opens while this page is already open. */
  onReveal(fn: Listener) {
    this.revealListeners.add(fn);
    return () => this.revealListeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get demo() {
    return DEMO;
  }

  async refresh() {
    const wasRevealed = this.loaded && this.event.revealed && !this.loadError;
    this.loadError = '';
    try {
      if (DEMO) {
        this.demoRows = get<Message[]>('ddi-messages', []);
        this.demoSettings = get<IslandEvent>('ddi-event', DEMO_EVENT);
        this.event = this.demoSettings;
        const own = this.demoRows.filter((x) => x.event_id === this.event.id && x.status === 'approved' && x.visibility === 'public');
        this.messages = this.event.revealed ? [...own, ...(this.event.id === 'preview' ? SAMPLES : [])] : [];
      } else {
        const rows = await api<IslandEvent[]>(`/rest/v1/island_event?singleton=eq.true&select=${EVENT_FIELDS}`);
        const ev = rows[0];
        if (!ev) throw new Error('No event configured');
        this.event = ev;
        this.messages = ev.revealed
          ? await api<Message[]>(
              '/rest/v1/island_messages?select=*&event_id=eq.' +
                encodeURIComponent(ev.id) +
                '&status=eq.approved&visibility=eq.public&order=created_at.desc',
            )
          : [];
      }
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
      this.event = { id: 'unavailable', title: 'Island temporarily unavailable', revealed: false };
      this.messages = [];
    }
    const firstLoad = !this.loaded;
    this.loaded = true;
    this.emit();
    if (!firstLoad && !wasRevealed && this.event.revealed && !this.loadError) this.revealListeners.forEach((fn) => fn());
  }

  /** Keep an open page in sync: the reveal and newly approved notes appear without a reload. */
  startWatching() {
    this.pollTimers.forEach(clearInterval);
    this.pollTimers = [];
    if (DEMO) {
      // Another tab of the same browser (e.g. the organizer panel) changed the local island.
      addEventListener('storage', (e) => {
        if (e.key && ['ddi-event', 'ddi-messages', 'ddi-ultimate-archives'].includes(e.key)) {
          this.archiveLocal = get<Archive[]>('ddi-ultimate-archives', []);
          void this.refresh();
        }
      });
      return;
    }
    const visible = () => document.visibilityState === 'visible';
    this.pollTimers.push(
      window.setInterval(async () => {
        if (!visible()) return;
        try {
          const rows = await api<IslandEvent[]>(`/rest/v1/island_event?singleton=eq.true&select=${EVENT_FIELDS}`);
          const ev = rows[0];
          if (!ev) return;
          const changed = ev.id !== this.event.id || ev.revealed !== this.event.revealed || ev.title !== this.event.title;
          if (changed || this.loadError) await this.refresh();
        } catch {
          /* offline for a moment — try again next tick */
        }
      }, POLL_EVENT_MS),
      // newly approved / hidden / deleted notes: compare a cheap count first
      window.setInterval(async () => {
        if (!visible() || !this.event.revealed || this.loadError) return;
        const n = await apiCount(
          '/rest/v1/island_messages?select=id&event_id=eq.' + encodeURIComponent(this.event.id) + '&status=eq.approved&visibility=eq.public',
        );
        if (n !== null && n !== this.messages.length) await this.refresh();
      }, POLL_COUNT_MS),
      window.setInterval(() => {
        if (visible() && this.event.revealed) void this.refresh();
      }, POLL_MESSAGES_MS),
    );
  }

  async submit(data: NewMessage) {
    if (DEMO) {
      const row: Message = {
        ...data,
        id: crypto.randomUUID?.() || String(Date.now()),
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      this.demoRows = [row, ...get<Message[]>('ddi-messages', [])];
      save('ddi-messages', this.demoRows);
    } else {
      await api('/rest/v1/island_messages', { method: 'POST', body: data, prefer: 'return=minimal' });
    }
  }

  /* ───────── Organizer ───────── */

  /** Calls an authenticated endpoint, refreshing an expired organizer session once. */
  private async authed<T>(path: string, opts: Parameters<typeof api>[1] = {}): Promise<T> {
    try {
      return await api<T>(path, { ...opts, auth: this.session });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && this.session?.refresh_token) {
        this.session = await api<Session>('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          body: { refresh_token: this.session.refresh_token },
        });
        return api<T>(path, { ...opts, auth: this.session });
      }
      throw e;
    }
  }

  async login(email: string, password: string) {
    try {
      this.session = await api<Session>('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      const own = await this.authed<{ user_id: string }[]>('/rest/v1/island_admins?select=user_id');
      if (!own.length) throw new Error('This account is not authorized.');
      this.admin = true;
      this.emit();
    } catch (e) {
      this.session = null;
      this.admin = false;
      throw e;
    }
  }

  logout() {
    this.session = null;
    this.admin = false;
    this.organizerRows = [];
    this.emit();
  }

  /** Preview Mode has no login: anyone on this device can use the test controls. */
  enterDemoOrganizer() {
    if (DEMO) this.admin = true;
  }

  async loadOrganizerRows() {
    this.organizerRows = DEMO
      ? get<Message[]>('ddi-messages', [])
      : await this.authed<Message[]>('/rest/v1/island_messages?select=*&order=created_at.desc');
    return this.organizerRows;
  }

  async saveSettings(data: { id: string; title: string; revealed: boolean }) {
    if (!this.admin) return;
    if (DEMO) {
      this.demoSettings = { ...data, finale_token: get<IslandEvent>('ddi-event', DEMO_EVENT).finale_token };
      save('ddi-event', this.demoSettings);
    } else {
      await this.authed('/rest/v1/island_event?singleton=eq.true', { method: 'PATCH', body: data, prefer: 'return=minimal' });
    }
    await this.refresh();
  }

  async review(id: string, status: Status | 'delete') {
    if (!this.admin) return;
    if (DEMO) {
      const rows = get<Message[]>('ddi-messages', []);
      this.demoRows = status === 'delete' ? rows.filter((m) => m.id !== id) : rows.map((m) => (m.id === id ? { ...m, status } : m));
      save('ddi-messages', this.demoRows);
    } else {
      await this.authed('/rest/v1/island_messages?id=eq.' + encodeURIComponent(id), {
        method: status === 'delete' ? 'DELETE' : 'PATCH',
        ...(status === 'delete' ? {} : { body: { status } }),
        prefer: 'return=minimal',
      });
    }
    await this.refresh();
  }

  exportRows() {
    if (!this.admin) return;
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), event: this.event, messages: this.organizerRows }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dani-donut-island-private-export.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Writes a fresh finale token. The OBS overlay + Streamer.bot bridge react to a NEW token only.
   *  A test token ("test-…") also plays on OBS overlays while the surprise is still sealed. */
  async signal(test = false) {
    const token = (test ? 'test-' : '') + (crypto.randomUUID?.() || String(Date.now()));
    if (DEMO) {
      this.demoSettings = { ...get<IslandEvent>('ddi-event', DEMO_EVENT), finale_token: token };
      save('ddi-event', this.demoSettings);
    } else {
      await this.authed('/rest/v1/island_event?singleton=eq.true', { method: 'PATCH', body: { finale_token: token }, prefer: 'return=minimal' });
    }
    await this.refresh();
  }

  async archive() {
    const row = { id: this.event.id, title: this.event.title };
    if (DEMO) {
      this.archiveLocal = [row, ...get<Archive[]>('ddi-ultimate-archives', []).filter((e) => e.id !== row.id)];
      save('ddi-ultimate-archives', this.archiveLocal);
    } else {
      const existing = await this.authed<{ id: string }[]>('/rest/v1/island_archives?id=eq.' + encodeURIComponent(row.id) + '&select=id');
      if (existing.length)
        await this.authed('/rest/v1/island_archives?id=eq.' + encodeURIComponent(row.id), {
          method: 'PATCH',
          body: { title: row.title },
          prefer: 'return=minimal',
        });
      else await this.authed('/rest/v1/island_archives', { method: 'POST', body: row, prefer: 'return=minimal' });
    }
  }

  /** Current chapter + every published (archived) chapter, for the Donut Diaries. */
  async loadDiary(): Promise<{ chapters: Archive[]; rows: Message[] }> {
    const editions = DEMO ? get<Archive[]>('ddi-ultimate-archives', []) : await api<Archive[]>('/rest/v1/island_archives?select=*&order=published_at.desc');
    let archived: Message[] = [];
    if (DEMO) {
      archived = get<Message[]>('ddi-messages', []).filter(
        (m) => m.status === 'approved' && m.visibility === 'public' && editions.some((e) => e.id === m.event_id),
      );
    } else if (editions.length) {
      archived = await api<Message[]>('/rest/v1/island_messages?select=*&status=eq.approved&visibility=eq.public&order=created_at.desc');
    }
    const rows = [...this.messages, ...archived.filter((m) => !this.messages.some((x) => x.id === m.id))];
    const chapters = [{ id: this.event.id, title: this.event.title }, ...editions.filter((e) => e.id !== this.event.id)];
    return { chapters, rows };
  }
}

export const store = new Store();

/* Tiny Supabase REST client (PostgREST + GoTrue) — no SDK needed. Same calls as the original island. */
import { CONFIG } from '../config';
import type { Session } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: Session | null;
  prefer?: string;
}

export async function api<T = unknown>(path: string, { method = 'GET', body, auth, prefer }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { apikey: CONFIG.key, 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = 'Bearer ' + auth.access_token;
  // New-style publishable keys are not JWTs and must not be sent as a bearer token.
  else if (!CONFIG.key.startsWith('sb_publishable_')) headers.Authorization = 'Bearer ' + CONFIG.key;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(CONFIG.url + path, {
    method,
    headers,
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    let t: { message?: string; msg?: string; error_description?: string } | undefined;
    try {
      t = await r.json();
    } catch {
      /* not JSON */
    }
    throw new ApiError(t?.message || t?.msg || t?.error_description || `Request failed (${r.status})`, r.status);
  }
  const raw = await r.text();
  return (raw ? JSON.parse(raw) : null) as T;
}

/** Counts rows with a HEAD request (no body is downloaded). Returns null if the count isn't available. */
export async function apiCount(path: string): Promise<number | null> {
  const headers: Record<string, string> = { apikey: CONFIG.key, Prefer: 'count=exact' };
  if (!CONFIG.key.startsWith('sb_publishable_')) headers.Authorization = 'Bearer ' + CONFIG.key;
  try {
    const r = await fetch(CONFIG.url + path, { method: 'HEAD', headers, cache: 'no-store' });
    const range = r.ok ? r.headers.get('content-range') : null;
    const total = range?.split('/')[1];
    return total && total !== '*' ? Number(total) : null;
  } catch {
    return null;
  }
}

/**
 * Thin client for the CAL-ABA site API.
 *
 * HARD RULE: the public site must render fully when this API is unreachable.
 * Every public read is time-boxed (3.5s), never throws out of the helper, and
 * returns `null` on any failure so the caller keeps its bundled fallback.
 */

/** Deployed HTTP API; overridable at build time with VITE_API_URL. */
const DEFAULT_API_BASE = 'https://5h4kz9dvqa.execute-api.us-east-1.amazonaws.com';

export const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_API_BASE
).replace(/\/+$/, '');

export const PUBLIC_TIMEOUT_MS = 3500;
/** Admin calls talk to a warm-ish Lambda but may cold start. */
export const ADMIN_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface FetchOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * JSON fetch with an AbortController timeout. Throws ApiError on non-2xx so
 * admin screens can branch on `status`; public helpers below swallow it.
 */
export async function fetchJson<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = PUBLIC_TIMEOUT_MS } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Caller-supplied signals (component unmount) abort us too.
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);

  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : '') || `Request failed (${res.status})`;
      throw new ApiError(res.status, message, data);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ *
 * sessionStorage cache — keeps repeat visits instant without letting a
 * stale copy outlive an admin edit. Reads are stale-while-revalidate:
 * the cached value paints immediately, a background fetch follows, and
 * `onFresh` fires only when the server actually returned something
 * different. A long TTL used to mean a deleted team member stayed on
 * screen for ten minutes.
 * ------------------------------------------------------------------ */

const CACHE_TTL_MS = 60 * 1000;

function cacheRead<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (!parsed || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function cacheWrite(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* private mode / quota — the network path still works */
  }
}

export function clearPublicCache() {
  try {
    sessionStorage.removeItem('calaba:testimonials');
    sessionStorage.removeItem('calaba:staff');
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Public reads
 * ------------------------------------------------------------------ */

export interface Testimonial {
  quote: string;
  attribution: string;
  location: string;
  service: string;
  initials: string;
  rating: number;
  order?: number;
}

export interface StaffPhoto {
  key?: string;
  url: string;
  w?: number;
  h?: number;
}

export interface PublicStaff {
  founder: {
    name: string;
    title: string;
    credentials?: string[];
    photo?: StaffPhoto | null;
  } | null;
  team: { name: string; title: string; photo?: StaffPhoto | null }[];
}

/**
 * A quote alone is not enough to render a card: the carousel also draws an
 * avatar medallion from `initials` and a byline from `attribution`, and an item
 * missing either renders as an empty circle with no name.
 */
function isTestimonial(t: unknown): t is Testimonial {
  if (!t || typeof t !== 'object') return false;
  const c = t as Partial<Testimonial>;
  return (
    typeof c.quote === 'string' &&
    c.quote.trim().length > 0 &&
    typeof c.attribution === 'string' &&
    c.attribution.trim().length > 0 &&
    typeof c.initials === 'string' &&
    c.initials.trim().length > 0
  );
}

/** The star row renders one icon per unit, so an unclamped rating is a DoS. */
function clampRating(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, n));
}

/**
 * In-flight de-duplication: Founder and Team both want the staff list, and a
 * cold page load would otherwise fire the same request twice.
 */
const inflight = new Map<string, Promise<unknown>>();

function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Approved + consented testimonials, or `null` to keep the bundled samples.
 * Only a non-empty, well-shaped array ever replaces the fallback.
 */
export async function getTestimonials(
  signal?: AbortSignal,
  onFresh?: (data: Testimonial[]) => void,
): Promise<Testimonial[] | null> {
  const cached = cacheRead<Testimonial[]>('calaba:testimonials');
  if (cached && cached.length > 0) {
    // Revalidate behind the paint; only disturb the UI on a real change.
    if (onFresh) {
      void fetchTestimonialsFresh().then((fresh) => {
        if (fresh && fresh.length > 0 && !signal?.aborted &&
            JSON.stringify(fresh) !== JSON.stringify(cached)) {
          onFresh(fresh);
        }
      });
    }
    return cached;
  }

  const result = await fetchTestimonialsFresh();
  return signal?.aborted ? null : result;
}

function fetchTestimonialsFresh(): Promise<Testimonial[] | null> {
  return once('testimonials', async () => {
    try {
      const data = await fetchJson<unknown>('/api/public/testimonials');
      if (!Array.isArray(data) || data.length === 0) return null;
      const items = data.filter(isTestimonial).map((t) => ({
        ...t,
        rating: clampRating(t.rating),
      }));
      if (items.length === 0) return null;
      cacheWrite('calaba:testimonials', items);
      return items;
    } catch {
      return null;
    }
  });
}

/** Live staff, or `null` to keep the bundled team/founder. */
export async function getStaff(
  signal?: AbortSignal,
  onFresh?: (data: PublicStaff) => void,
): Promise<PublicStaff | null> {
  const cached = cacheRead<PublicStaff>('calaba:staff');
  if (cached) {
    // Revalidate behind the paint; only disturb the UI on a real change.
    if (onFresh) {
      void fetchStaffFresh().then((fresh) => {
        if (fresh && !signal?.aborted && JSON.stringify(fresh) !== JSON.stringify(cached)) {
          onFresh(fresh);
        }
      });
    }
    return cached;
  }

  const result = await fetchStaffFresh();
  return signal?.aborted ? null : result;
}

function fetchStaffFresh(): Promise<PublicStaff | null> {
  return once('staff', async () => {
    try {
      const data = await fetchJson<PublicStaff>('/api/public/staff');
      if (!data || typeof data !== 'object') return null;
      const team = Array.isArray(data.team) ? data.team.filter((m) => m && m.name) : [];
      const founder =
        data.founder && typeof data.founder === 'object' && data.founder.name
          ? data.founder
          : null;
      if (!founder && team.length === 0) return null;
      const value: PublicStaff = { founder, team };
      cacheWrite('calaba:staff', value);
      return value;
    } catch {
      return null;
    }
  });
}

/* ------------------------------------------------------------------ *
 * Public writes
 * ------------------------------------------------------------------ */

/** Milliseconds a form must be open before we believe a human filled it. */
export const MIN_FORM_AGE_MS = 3000;

export interface SubmitResult {
  ok: true;
  id: string | null;
}

/** Reviews and applications get longer than a read — SES + S3 happen inline. */
export const SUBMIT_TIMEOUT_MS = 20000;

export function postReview(payload: unknown) {
  return fetchJson<SubmitResult>('/api/reviews', {
    method: 'POST',
    body: payload,
    timeoutMs: SUBMIT_TIMEOUT_MS,
  });
}

export interface UploadTicket {
  /** null when the submission was silently dropped as spam */
  uploadId: string | null;
  /**
   * The SERVER-sanitised filename. It is part of the S3 key, so the follow-up
   * POST /api/applications must echo this exact value back or the résumé can't
   * be found and moved.
   */
  filename?: string;
  url?: string;
  fields?: Record<string, string>;
  expiresIn?: number;
}

export function getResumeUploadUrl(payload: {
  filename: string;
  contentType: string;
  size: number;
  company?: string;
  formOpenedAt?: number;
}) {
  return fetchJson<UploadTicket>('/api/applications/upload-url', {
    method: 'POST',
    body: payload,
    timeoutMs: SUBMIT_TIMEOUT_MS,
  });
}

/** Browser -> S3 directly, so the résumé never passes through Lambda. */
export async function uploadToS3(ticket: UploadTicket, file: File): Promise<void> {
  if (!ticket.url || !ticket.fields) return;
  const form = new FormData();
  Object.entries(ticket.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(ticket.url, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, `Upload failed (${res.status})`);
  } finally {
    clearTimeout(timer);
  }
}

export function postApplication(payload: unknown) {
  return fetchJson<SubmitResult>('/api/applications', {
    method: 'POST',
    body: payload,
    timeoutMs: SUBMIT_TIMEOUT_MS,
  });
}

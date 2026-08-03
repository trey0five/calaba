import { ADMIN_TIMEOUT_MS, ApiError, fetchJson } from '@/lib/api';
import type {
  AdminApplication,
  AdminReview,
  AdminUser,
  ApplicationStatus,
  AuthUser,
  ReviewAudience,
  ReviewDisplay,
  ReviewStatus,
  StaffMember,
} from './types';

export { ApiError };

type Token = string | null;

function call<T>(path: string, token: Token, init: { method?: string; body?: unknown } = {}) {
  return fetchJson<T>(path, { ...init, token, timeoutMs: ADMIN_TIMEOUT_MS });
}

/**
 * Endpoints may answer `[...]` or `{items: [...]}` depending on the route.
 * Normalise once here rather than guessing at every call site.
 */
function items<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: T[] }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

function counts(data: unknown): Record<string, number> {
  if (data && typeof data === 'object' && (data as { counts?: unknown }).counts) {
    const c = (data as { counts: Record<string, unknown> }).counts;
    const out: Record<string, number> = {};
    Object.entries(c).forEach(([k, v]) => {
      out[k] = Number(v) || 0;
    });
    return out;
  }
  return {};
}

export interface ListResult<T> {
  items: T[];
  counts: Record<string, number>;
}

/* ----------------------------- auth ----------------------------- */

export interface LoginResult {
  token: string;
  user: AuthUser;
  expiresIn: number;
}

export function login(email: string, password: string) {
  return fetchJson<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    timeoutMs: ADMIN_TIMEOUT_MS,
  });
}

export function refresh(token: string) {
  return call<LoginResult>('/api/auth/refresh', token, { method: 'POST' });
}

export function me(token: string) {
  return call<{ user: AuthUser }>('/api/auth/me', token);
}

export function changePassword(token: Token, currentPassword: string, newPassword: string) {
  // The server revokes every token issued before the change and hands back a
  // replacement, so the tab you are sitting in is not signed out.
  return call<{ ok: true; token?: string; user?: AuthUser }>('/api/auth/change-password', token, {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

/* ---------------------------- reviews --------------------------- */

/**
 * Every review, both audiences. The server also accepts `?audience=family|staff`,
 * but the screen segments the one loaded collection client-side so the tabs
 * switch instantly and the nav badges cannot disagree with the list.
 */
export async function listReviews(
  token: Token,
  audience?: ReviewAudience,
): Promise<ListResult<AdminReview>> {
  const query = audience ? `?audience=${encodeURIComponent(audience)}` : '';
  const data = await call<unknown>(`/api/admin/reviews${query}`, token);
  return { items: items<AdminReview>(data), counts: counts(data) };
}

export function updateReview(
  token: Token,
  id: string,
  patch: { status?: ReviewStatus; display?: Partial<ReviewDisplay>; note?: string },
) {
  // Answers with the whole updated record.
  return call<AdminReview>(`/api/admin/reviews/${id}`, token, { method: 'PUT', body: patch });
}

export function deleteReview(token: Token, id: string) {
  return call<{ ok: true }>(`/api/admin/reviews/${id}`, token, { method: 'DELETE' });
}

/* ----------------------------- staff ---------------------------- */

export async function listStaff(token: Token): Promise<StaffMember[]> {
  const data = await call<unknown>('/api/admin/staff', token);
  return items<StaffMember>(data);
}

export function createStaff(token: Token, body: Partial<StaffMember>) {
  return call<StaffMember>('/api/admin/staff', token, { method: 'POST', body });
}

export function updateStaff(token: Token, id: string, body: Partial<StaffMember>) {
  return call<StaffMember>(`/api/admin/staff/${id}`, token, { method: 'PUT', body });
}

export function deleteStaff(token: Token, id: string) {
  return call<{ ok: true }>(`/api/admin/staff/${id}`, token, { method: 'DELETE' });
}

/**
 * Photo upload. The browser has already resized to <=1200px WebP, so the
 * base64 payload stays well under the 2MB decoded cap.
 */
export function uploadStaffPhoto(
  token: Token,
  id: string,
  body: { data: string; contentType: string; w: number; h: number },
) {
  // Answers with the updated staff record, photo included.
  return call<StaffMember>(`/api/admin/staff/${id}/photo`, token, { method: 'POST', body });
}

/* -------------------------- applications ------------------------ */

export async function listApplications(token: Token): Promise<ListResult<AdminApplication>> {
  const data = await call<unknown>('/api/admin/applications', token);
  return { items: items<AdminApplication>(data), counts: counts(data) };
}

export function getApplication(token: Token, id: string) {
  return call<AdminApplication>(`/api/admin/applications/${id}`, token);
}

/** Always minted fresh — presigned URLs expire and are never emailed. */
export interface ResumeTicket {
  url: string;
  filename?: string;
  /** true only when the server will serve it as an inline PDF */
  inline: boolean;
}

export async function getResumeUrl(token: Token, id: string): Promise<ResumeTicket> {
  const data = await call<unknown>(`/api/admin/applications/${id}/resume`, token);
  if (typeof data === 'string') return { url: data, inline: false };
  const obj = (data ?? {}) as Record<string, unknown>;
  const url = obj.url ?? obj.resumeUrl ?? obj.downloadUrl;
  if (typeof url !== 'string' || !url) {
    throw new ApiError(500, 'No résumé link came back from the server.');
  }
  return {
    url,
    filename: typeof obj.filename === 'string' ? obj.filename : undefined,
    inline: obj.inline === true,
  };
}

export function updateApplication(token: Token, id: string, status: ApplicationStatus) {
  return call<{ ok: true }>(`/api/admin/applications/${id}`, token, {
    method: 'PUT',
    body: { status },
  });
}

export function deleteApplication(token: Token, id: string) {
  return call<{ ok: true }>(`/api/admin/applications/${id}`, token, { method: 'DELETE' });
}

/* ----------------------------- users ---------------------------- */

export async function listUsers(token: Token): Promise<AdminUser[]> {
  const data = await call<unknown>('/api/admin/users', token);
  return items<AdminUser>(data);
}

export function createUser(
  token: Token,
  body: { email: string; name: string; password: string; role: 'owner' | 'staff' },
) {
  return call<AdminUser>('/api/admin/users', token, { method: 'POST', body });
}

export function deleteUser(token: Token, id: string) {
  return call<{ ok: true }>(`/api/admin/users/${id}`, token, { method: 'DELETE' });
}

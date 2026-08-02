import { useEffect, useState } from 'react';

/**
 * Hash routing, deliberately hand-rolled: the public site is a single scrolling
 * page and pulling in a router would ship bytes to every visitor. Admin routes
 * all live under `#/admin`.
 */

export type AdminArea = 'overview' | 'reviews' | 'staff' | 'applications' | 'account';

export interface AdminRoute {
  area: AdminArea;
  /** trailing id segment, e.g. #/admin/applications/ap_1234 */
  id: string | null;
  /** ?key=value pairs after the path */
  query: Record<string, string>;
}

const AREAS: AdminArea[] = ['overview', 'reviews', 'staff', 'applications', 'account'];

export function parseHash(hash: string): AdminRoute {
  const raw = hash.replace(/^#\/?/, '');
  const [path, search = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean); // ['admin', area?, id?]
  const areaPart = parts[1] ?? '';
  const area = (AREAS as string[]).includes(areaPart) ? (areaPart as AdminArea) : 'overview';
  const query: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => {
    query[k] = v;
  });
  return { area, id: parts[2] ?? null, query };
}

export function adminHref(area: AdminArea, id?: string, query?: Record<string, string>) {
  const q = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : '';
  const path = area === 'overview' ? '' : `/${area}${id ? `/${id}` : ''}`;
  return `#/admin${path}${q}`;
}

export function navigate(area: AdminArea, id?: string, query?: Record<string, string>) {
  window.location.hash = adminHref(area, id, query);
}

export function useAdminRoute(): AdminRoute {
  const [route, setRoute] = useState<AdminRoute>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

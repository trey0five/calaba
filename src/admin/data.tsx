import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, clearPublicCache } from '@/lib/api';
import * as api from './adminApi';
import { useAuth } from './auth';
import type { AdminApplication, AdminReview, StaffMember } from './types';
import { type Hue } from './ui';

/**
 * One fetch of each collection for the whole session. Screens read from here
 * and mutate optimistically, so nav badges, the dashboard and the lists can
 * never disagree with each other.
 */

export interface ActivityEntry {
  at: string;
  text: string;
  hue: Hue;
}

const ACTIVITY_KEY = 'calaba:admin:activity';

const HUE_NAMES: Hue[] = ['gold', 'magenta', 'teal', 'coral'];

/**
 * localStorage is attacker-and-bit-rot-writable. Anything read back out is
 * treated as untrusted: a bad `hue` here used to crash the dashboard render.
 */
function readActivity(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ActivityEntry =>
          !!e &&
          typeof e === 'object' &&
          typeof (e as ActivityEntry).text === 'string' &&
          typeof (e as ActivityEntry).at === 'string',
      )
      .map((e) => ({
        at: e.at,
        text: e.text,
        hue: HUE_NAMES.includes(e.hue) ? e.hue : 'gold',
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

interface DataContextValue {
  reviews: AdminReview[];
  applications: AdminApplication[];
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  setReviews: (fn: (prev: AdminReview[]) => AdminReview[]) => void;
  setApplications: (fn: (prev: AdminApplication[]) => AdminApplication[]) => void;
  setStaff: (fn: (prev: StaffMember[]) => StaffMember[]) => void;
  activity: ActivityEntry[];
  logActivity: (text: string, hue: Hue) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { authed, token } = useAuth();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>(() => readActivity());

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!token) return;
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([
      authed((t) => api.listReviews(t)),
      authed((t) => api.listApplications(t)),
      authed((t) => api.listStaff(t)),
    ])
      .then(([r, a, s]) => {
        if (!live) return;
        setReviews(r.items);
        setApplications(a.items);
        setStaff(s);
      })
      .catch((err) => {
        if (!live) return;
        // A 401 is already handled by the auth layer (login overlay). Setting
        // `error` too put a wrong "check your connection" card behind the
        // overlay, so the person re-authenticating saw a network complaint.
        if (err instanceof ApiError && err.status === 401) {
          setError(null);
          return;
        }
        setError(
          err instanceof ApiError
            ? err.message
            : 'Couldn’t load your data. Check your connection and try again.',
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [authed, token, nonce]);

  const logActivity = useCallback((text: string, hue: Hue) => {
    setActivity((list) => {
      const next = [{ at: new Date().toISOString(), text, hue }, ...list].slice(0, 20);
      try {
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    // Anything worth logging changed what the public site should show.
    clearPublicCache();
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      reviews,
      applications,
      staff,
      loading,
      error,
      reload,
      setReviews,
      setApplications,
      setStaff,
      activity,
      logActivity,
    }),
    [reviews, applications, staff, loading, error, reload, activity, logActivity],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAdminData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAdminData must be used inside <AdminDataProvider>');
  return ctx;
}

/** Badge counts shared by the sidebar, the bottom bar and the dashboard. */
export function useCounts() {
  const { reviews, applications, staff } = useAdminData();
  return useMemo(
    () => ({
      pendingReviews: reviews.filter((r) => r.status === 'pending').length,
      publishedReviews: reviews.filter((r) => r.status === 'approved').length,
      rejectedReviews: reviews.filter((r) => r.status === 'rejected').length,
      newApplications: applications.filter((a) => a.status === 'new').length,
      teamMembers: staff.filter((s) => s.active !== false).length,
    }),
    [reviews, applications, staff],
  );
}

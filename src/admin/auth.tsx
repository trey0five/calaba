import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError } from '@/lib/api';
import * as api from './adminApi';
import type { AuthUser } from './types';

const TOKEN_KEY = 'calaba:admin:token';
const USER_KEY = 'calaba:admin:user';
/** Tokens live 12h; top them up well before that so a long session never dies. */
const REFRESH_EVERY_MS = 4 * 60 * 60 * 1000;

interface Stored {
  token: string;
  user: AuthUser;
}

function readStored(): Stored | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

function writeStored(value: Stored | null) {
  try {
    if (!value) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, value.token);
    localStorage.setItem(USER_KEY, JSON.stringify(value.user));
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  /** true once a stored token has been checked (or none was found) */
  ready: boolean;
  /** signed in, but the server has since rejected the token */
  expired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** Adopt a token minted by a non-login route (e.g. change-password). */
  adoptSession: (token: string, user?: AuthUser | null) => void;
  /**
   * Wraps an admin call. A 401 flips the session into `expired` — the shell
   * stays mounted (drawer drafts survive) and a login overlay appears.
   */
  authed: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored | null>(() => readStored());
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const tokenRef = useRef<string | null>(stored?.token ?? null);
  tokenRef.current = stored?.token ?? null;

  const apply = useCallback((value: Stored | null) => {
    setStored(value);
    tokenRef.current = value?.token ?? null;
    writeStored(value);
  }, []);

  /* Validate whatever was in storage before showing the shell. */
  useEffect(() => {
    let live = true;
    const current = readStored();
    if (!current) {
      setReady(true);
      return;
    }
    api
      .refresh(current.token)
      .then((res) => {
        if (!live) return;
        apply({ token: res.token, user: res.user ?? current.user });
      })
      .catch((err) => {
        if (!live) return;
        // Network trouble shouldn't log anyone out — only an actual rejection.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          apply(null);
        }
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [apply]);

  /* Keep the token fresh while the tab stays open. */
  useEffect(() => {
    if (!stored?.token) return;
    const t = window.setInterval(() => {
      const token = tokenRef.current;
      if (!token) return;
      api
        .refresh(token)
        .then((res) => apply({ token: res.token, user: res.user ?? stored.user }))
        .catch(() => {
          /* the next real call will surface the 401 */
        });
    }, REFRESH_EVERY_MS);
    return () => window.clearInterval(t);
  }, [stored?.token, stored?.user, apply]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email.trim().toLowerCase(), password);
      apply({ token: res.token, user: res.user });
      setExpired(false);
    },
    [apply],
  );

  const signOut = useCallback(() => {
    apply(null);
    setExpired(false);
  }, [apply]);

  const adoptSession = useCallback(
    (token: string, nextUser?: AuthUser | null) => {
      const existing = readStored();
      const resolved = nextUser ?? existing?.user;
      if (!token || !resolved) return;
      apply({ token, user: resolved });
      setExpired(false);
    },
    [apply],
  );

  const authed = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = tokenRef.current;
    if (!token) {
      setExpired(true);
      throw new ApiError(401, 'Your session has ended. Please sign in again.');
    }
    try {
      return await fn(token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      throw err;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: stored?.token ?? null,
      user: stored?.user ?? null,
      ready,
      expired,
      signIn,
      signOut,
      adoptSession,
      authed,
    }),
    [stored, ready, expired, signIn, signOut, adoptSession, authed],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

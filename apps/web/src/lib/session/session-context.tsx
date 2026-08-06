"use client";

/**
 * T-002-W1 ★ — the one place the app decides "is anybody logged in".
 *
 * `SessionProvider` runs exactly ONE silent refresh on mount (web.md §3.1's
 * "cold-start restore"): a page load loses the in-memory access token by
 * design (token-store.ts), so the only way to tell a live session from a dead
 * one is to ask `/auth/refresh` once. Until that settles the state is
 * `unknown` and callers must render a skeleton.
 *
 * It does not redirect. Routing is the route's job (`RequireSession` below,
 * used by the org layout) — a provider that navigates would fire on every
 * tree it wraps, including `/login` itself.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { silentRefresh } from "../auth-client";
import { clearAccessToken } from "../token-store";
import {
  SESSION_UNKNOWN,
  settledSession,
  type SessionState,
} from "./session-state";

interface SessionValue {
  readonly state: SessionState;
  /** Drop the local session. Used by the 401 path and by logout. */
  readonly endSession: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  children,
  /** Test seam. Production always uses F-001's single-flight `silentRefresh`. */
  bootstrap = silentRefresh,
}: {
  children: ReactNode;
  bootstrap?: () => Promise<boolean>;
}) {
  const [state, setState] = useState<SessionState>(SESSION_UNKNOWN);

  useEffect(() => {
    let alive = true;
    bootstrap()
      .then((refreshed) => {
        if (alive) setState(settledSession(refreshed));
      })
      .catch(() => {
        // `silentRefresh` does not throw, but a seam might. An unresolved
        // bootstrap would pin the app in `unknown` forever — a blank app is
        // worse than an honest "please sign in".
        if (alive) setState(settledSession(false));
      });
    return () => {
      alive = false;
    };
    // Empty deps on purpose: bootstrap runs ONCE per page load. `bootstrap`
    // is intentionally not a dependency — re-running on a prop identity
    // change would turn a re-render into an auth round-trip, and in the only
    // case where it changes (a test swapping the seam) the component is
    // remounted anyway.
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      endSession: () => {
        clearAccessToken();
        setState(settledSession(false));
      },
    }),
    [state],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession was called outside <SessionProvider> — mount it in the root layout");
  }
  return ctx;
}

"use client";

/**
 * T-002-W6 ★ — read the token out of the URL, then take it out of the URL.
 *
 * The strip happens in a LAYOUT effect, not a passive one: `useEffect` runs
 * after paint, so the token would be in the address bar for at least one
 * rendered frame — long enough for a screenshot, a screenshare, or an error
 * reporter that captures `location.href` on mount. `useLayoutEffect` runs
 * before the browser paints.
 *
 * The token then lives in a ref for the life of this component and nowhere
 * else: not in a query cache, not in state that could be serialised into a
 * devtools snapshot, and never back into the URL.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { stripInviteToken } from "./invite-token";

export interface InviteTokenHandle {
  /** The token, or `null` once we know the link carried none. */
  readonly token: string | null;
  /** False until the first read has happened, so the screen can hold off. */
  readonly ready: boolean;
}

export function useInviteToken(): InviteTokenHandle {
  const tokenRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const { token, cleanUrl } = stripInviteToken(window.location.href);
    tokenRef.current = token;

    if (token !== null) {
      // `replaceState`, never `pushState`: pushing would leave the
      // token-bearing entry in history, one Back press away — the opposite of
      // the point.
      window.history.replaceState(window.history.state, "", cleanUrl);
    }
    setReady(true);
  }, []);

  return { token: tokenRef.current, ready };
}

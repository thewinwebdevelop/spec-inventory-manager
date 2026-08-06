"use client";

/**
 * T-002-W1 — the client boundary for the whole app.
 *
 * `RootLayout` stays a Server Component (bundle, static chrome); everything
 * that needs browser state hangs off this one boundary. The QueryClient is
 * created in state rather than at module scope so it is one instance per page
 * load per tab — two tabs get two caches, which is what makes "two tabs, two
 * shops" work for free (web.md §3.2).
 */
import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "../../lib/api/query-client";
import { SessionProvider } from "../../lib/session/session-context";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

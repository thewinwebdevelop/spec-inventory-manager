"use client";

/**
 * Unsaved-changes guard for a form page (T-003-W06, ux-wireframe R3 "ออกจากจอ
 * ทั้งที่มีของค้าง (ยกเลิก / ← / ปิดแท็บ / เปลี่ยนเมนู)").
 *
 * The App Router has no "route change start" event to veto, so this guards the
 * three ways a person actually leaves:
 *  1. the page's own buttons (ยกเลิก) → call `leave(href)`;
 *  2. any in-app `<a href>` (the ← link, the sidebar menu, ButtonLink) → a
 *     CAPTURE-phase click listener on `document` stops the click before
 *     React/Next's `<Link>` handler sees it, and asks instead;
 *  3. closing / reloading the tab → `beforeunload` (the browser's own prompt;
 *     its wording is not ours to set);
 *  4. a BUTTON that leaves the page (the sidebar's sign-out) opts in with
 *     `data-leave-guard="<where it goes>"`: the click is held, and replayed on
 *     confirm. Found in the D-038 ③ manual pass — sign-out dropped unsaved
 *     role edits without a word.
 *
 * Known gap: the browser's Back button (popstate) is not intercepted — the
 * App Router owns history and a pushState trick fights it. web.md §3.6's
 * `form/` dirty guard (F-010) is the place to close that for every form.
 *
 * While `dirty` is false nothing is intercepted. A programmatic
 * `router.push` (e.g. after a successful create) is not a click, so it is
 * never intercepted.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface LeaveGuard {
  /** The href waiting on the person's answer, or `null`. */
  readonly pendingHref: string | null;
  /** Navigate now, or ask first if there are unsaved changes. */
  readonly leave: (href: string) => void;
  readonly confirmLeave: () => void;
  readonly cancelLeave: () => void;
}

function internalHref(anchor: HTMLAnchorElement): string | null {
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const here = window.location;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return url.pathname + url.search + url.hash;
}

export function useLeaveGuard(dirty: boolean): LeaveGuard {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // The held `data-leave-guard` button, replayed on confirm (case 4).
  const pendingActionRef = useRef<HTMLElement | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a returnValue to show the prompt.
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const action = (event.target as Element | null)?.closest?.("[data-leave-guard]");
      if (action instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        pendingActionRef.current = action;
        setPendingHref(action.dataset.leaveGuard || "");
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = internalHref(anchor);
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const leave = useCallback(
    (href: string) => {
      if (dirtyRef.current) setPendingHref(href);
      else router.push(href);
    },
    [router],
  );

  const confirmLeave = useCallback(() => {
    const href = pendingHref;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setPendingHref(null);
    if (href === null) return;
    // The page is being abandoned on purpose: stop guarding before we go.
    dirtyRef.current = false;
    if (action) {
      action.click();
      return;
    }
    router.push(href);
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => {
    pendingActionRef.current = null;
    setPendingHref(null);
  }, []);

  return { pendingHref, leave, confirmLeave, cancelLeave };
}

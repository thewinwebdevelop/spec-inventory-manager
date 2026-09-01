/**
 * `icon.<role>` — design-system §1.6.2, which is explicit that CODE NAMES THE
 * ROLE, never the vendor's icon, so the set can be swapped without any screen
 * changing meaning.
 *
 * ★ §8.4 item 5 forbids emoji, filled icons and pictures outright, and the app
 * was shipping three emoji — 👁 / 🙈 on the password field and 🔒 on the
 * forbidden panel — plus glyph stand-ins (▾ ✓ ☰ ✕ ⚠) typed straight into JSX.
 * A glyph is not an icon: it renders in whatever the user's font decides, it
 * inherits none of `icon.stroke`, and it cannot be sized by `size.icon.*`.
 *
 * ⚠️ The paths below are lifted from the SIGNED-OFF mockup
 * (docs/design-system/mockup/f002-org.html), not drawn here. §1.6.2 names
 * `@phosphor-icons/react` as the web source, which is a new dependency and
 * therefore the user's call (Gate E) — when that is approved this file's body
 * becomes a re-export and NOTHING ELSE IN THE APP CHANGES, which is the whole
 * point of naming roles.
 *
 * grid 24 · stroke 2 · `currentColor` · outline only (§1.6.1).
 */
import { cn } from "./utils";

const PATHS = {
  warn: <><path d="M12 3.6 2.8 19.4h18.4L12 3.6Z" /><path d="M12 9.6v4.1" /><path d="M12 17.1h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.8" /><path d="M12 11.2v5" /><path d="M12 7.9h.01" /></>,
  error: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.4v5.4" /><path d="M12 16.4h.01" /></>,
  check: <path d="m4.8 12.6 4.9 4.9L19.4 7.8" />,
  "check-circle": <><circle cx="12" cy="12" r="8.8" /><path d="m8.1 12.2 2.7 2.7 5.3-5.3" /></>,
  mail: <><rect x="3.2" y="5.6" width="17.6" height="12.8" rx="2" /><path d="m3.6 7 8.4 5.8L20.4 7" /></>,
  users: (
    <>
      <path d="M15.5 20.4v-1.7a4 4 0 0 0-4-4H6.2a4 4 0 0 0-4 4v1.7" />
      <circle cx="8.85" cy="7.4" r="3.6" />
      <path d="M21.8 20.4v-1.7a4 4 0 0 0-3-3.86" />
      <path d="M16.2 4a4 4 0 0 1 0 7.75" />
    </>
  ),
  clock: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.2V12l3 1.9" /></>,
  hourglass: (
    <>
      <path d="M7 3.4h10" />
      <path d="M7 20.6h10" />
      <path d="M7 3.4v3.3c0 1.4 1 2.6 2.2 3.4L12 12l-2.8 1.9c-1.2.8-2.2 2-2.2 3.4v3.3" />
      <path d="M17 3.4v3.3c0 1.4-1 2.6-2.2 3.4L12 12l2.8 1.9c1.2.8 2.2 2 2.2 3.4v3.3" />
    </>
  ),
  "chevron-right": <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  "chevron-down": <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  plus: <><path d="M12 5.2v13.6" /><path d="M5.2 12h13.6" /></>,
  circle: <circle cx="12" cy="12" r="8.3" />,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  lock: (
    <>
      <rect x="4.2" y="10.4" width="15.6" height="10" rx="2" />
      <path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8" />
    </>
  ),
  copy: (
    <>
      <rect x="8.4" y="8.4" width="11.4" height="11.4" rx="2" />
      <path d="M15.6 8.4V6.2a2 2 0 0 0-2-2H6.2a2 2 0 0 0-2 2v7.4a2 2 0 0 0 2 2h2.2" />
    </>
  ),
  back: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  eye: <><path d="M2.4 12S6.2 5.6 12 5.6 21.6 12 21.6 12 17.8 18.4 12 18.4 2.4 12 2.4 12Z" /><circle cx="12" cy="12" r="3.2" /></>,
  "eye-off": (
    <>
      <path d="M4 4.6 19.4 20" />
      <path d="M9.6 6.1A9.6 9.6 0 0 1 12 5.6c5.8 0 9.6 6.4 9.6 6.4a17 17 0 0 1-3.1 3.8" />
      <path d="M6.3 8.2A17.6 17.6 0 0 0 2.4 12s3.8 6.4 9.6 6.4a9.4 9.4 0 0 0 3.2-.55" />
      <path d="M10 10.2a3.2 3.2 0 0 0 4.2 4.4" />
    </>
  ),
} as const;

export type IconRole = keyof typeof PATHS;

/** `size.icon.*` (§1.2). `md` is the default: banner, button, list row. */
const SIZE = {
  sm: "h-[var(--size-icon-sm)] w-[var(--size-icon-sm)]",
  md: "h-[var(--size-icon-md)] w-[var(--size-icon-md)]",
  lg: "h-[var(--size-icon-lg)] w-[var(--size-icon-lg)]",
  xl: "h-[var(--size-icon-xl)] w-[var(--size-icon-xl)]",
} as const;

export function Icon({
  role,
  size = "md",
  className,
  title,
}: {
  role: IconRole;
  size?: keyof typeof SIZE;
  className?: string;
  /** Give one ONLY when the icon is the sole label; otherwise it is decoration. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      /* `icon.stroke` = 2, dropping to 1.5 at `xl` so a 40px icon does not
         read as heavier than the text beside it (§1.2). */
      strokeWidth={size === "xl" ? 1.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      className={cn("flex-none", SIZE[size], className)}
    >
      {PATHS[role]}
    </svg>
  );
}

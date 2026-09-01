"use client";

/**
 * S8 ★ — the one-time invitation link (ux-wireframe §9.1, D-027).
 *
 * What is on screen here is a bearer credential for membership of a shop. The
 * server keeps only its hash (D-018), so this panel is the only place the raw
 * token will ever exist. Three consequences, all of them enforced rather than
 * remembered:
 *
 *  - the state that holds it has no "hidden" variant that keeps it
 *    (`invite-link.ts` — closing DISCARDS);
 *  - the expiry is rendered from `expiresAt`, never as a hard-coded duration;
 *  - the exit becomes prominent only after the link has been copied.
 *
 * That last one is the whole guard rail. §9.1 deliberately rejected a second
 * layer ("are you sure you copied it?") as too much, on the grounds that the
 * warning already sits above the close button. What replaces the dialog is
 * button WEIGHT: `secondary` until copied, `primary` after.
 */
import { useState } from "react";
import {
  closeButtonVariant,
  markCopied,
  visibleInviteUrl,
  type InviteLinkState,
} from "../invite-link";
import { copyLinkTh } from "../i18n";
import { formatExpiry } from "../expiry";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/providers/ToastProvider";

export function CopyLinkPanel({
  state,
  onStateChange,
  onClose,
  /** Test seam — jsdom has no clipboard, and neither does an insecure origin. */
  writeClipboard = (text: string) => navigator.clipboard.writeText(text),
}: {
  state: InviteLinkState;
  onStateChange: (next: InviteLinkState) => void;
  onClose: () => void;
  writeClipboard?: (text: string) => Promise<void>;
}) {
  const [copyFailed, setCopyFailed] = useState(false);
  const toast = useToast();
  const url = visibleInviteUrl(state);
  if (state.status !== "open" || url === null) return null;

  const copy = async () => {
    setCopyFailed(false);
    try {
      await writeClipboard(url);
      onStateChange(markCopied(state));
      toast.success(copyLinkTh.copiedToast);
    } catch {
      // §9.1: the clipboard API can simply be refused. The link stays on
      // screen and selectable — never a dead end, and never a silent failure
      // that leaves the user thinking they have it.
      setCopyFailed(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={copyLinkTh.title}
      className="space-y-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card"
    >
      <h3 className="m-0 text-heading-sm">{copyLinkTh.title}</h3>
      <p className="m-0 text-body-sm text-text-muted">{copyLinkTh.description(state.email)}</p>

      {/* Read-only rather than disabled: the user must be able to select it by
          hand when the clipboard is unavailable. */}
      <input
        readOnly
        value={url}
        aria-label={copyLinkTh.title}
        className="w-full rounded-button border border-border-default bg-surface-muted p-3 font-mono text-body-sm"
      />

      <Button onClick={() => void copy()} fullWidth>
        {state.copied ? copyLinkTh.copied : copyLinkTh.copy}
      </Button>
      {copyFailed && (
        <p role="alert" className="text-body-sm text-danger-text">
          {copyLinkTh.copyFailed}
        </p>
      )}

      {/* Read from `expiresAt`. D-027 forbids printing "7 days": the TTL
          depends on the role and is recomputed on every reissue. */}
      <p className="m-0 text-body-sm text-text-muted">{formatExpiry(state.expiresAt)}</p>

      {/* Warning tone, and ABOVE the close button — that placement is the
          reason §9.1 could drop the confirm dialog. */}
      <p
        role="note"
        className="rounded-card border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text"
      >
        {copyLinkTh.onceOnly}
      </p>

      <Button variant={closeButtonVariant(state)} onClick={onClose}>
        {copyLinkTh.close}
      </Button>
    </div>
  );
}

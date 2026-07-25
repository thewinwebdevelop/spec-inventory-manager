/**
 * `ErrorBanner` — reusable across every auth form (ui.md §2.1). Red banner
 * above the form, `aria-live="polite"` so screen readers announce it
 * immediately (ui.md §6 accessibility notes).
 */
export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-4 flex items-center justify-between gap-3 rounded-card border border-danger-border bg-danger-bg p-4 text-body-sm text-danger-text"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer whitespace-nowrap border-none bg-transparent font-semibold text-danger-text underline"
        >
          {retryLabel ?? "ลองใหม่"}
        </button>
      )}
    </div>
  );
}

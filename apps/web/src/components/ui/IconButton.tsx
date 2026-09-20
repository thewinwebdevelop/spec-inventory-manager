/** `.iconbtn` from the mockup — a square 44px tap target, no border, no fill. */
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

export function IconButton({
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "flex flex-none items-center justify-center rounded-button border-0 bg-transparent text-text-muted",
        "h-[var(--size-tap-target-min)] w-[var(--size-tap-target-min)]",
        "hover:bg-surface-muted hover:text-text",
        className,
      )}
    />
  );
}

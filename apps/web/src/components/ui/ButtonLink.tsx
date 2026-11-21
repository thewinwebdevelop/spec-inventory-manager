"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants, type ButtonProps } from "./Button";
import { cn } from "./utils";

/**
 * A navigation that LOOKS like a `Button` — one `<a>`, nothing inside it.
 *
 * Replaces `<Link><Button/></Link>`, which nested a <button> inside an <a>
 * (interactive inside interactive: invalid HTML, two controls to a screen
 * reader) and left the <a> itself an 18px-tall inline box. Found by the
 * D-038 ② responsive check (tap target ≥ 44px, design-system §8.4).
 *
 * Same variants/sizes as `Button` (same `buttonVariants`), so it looks exactly
 * like one — including `min-h` = `size.tap-target.min` — and `no-underline`
 * because it is a button-shaped thing, not prose.
 */
export type ButtonLinkProps = ComponentProps<typeof Link> &
  Pick<ButtonProps, "variant" | "size" | "fullWidth">;

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...link
}: ButtonLinkProps) {
  return (
    <Link
      {...link}
      className={cn(
        buttonVariants({ variant, size, fullWidth }),
        "cursor-pointer no-underline",
        className,
      )}
    />
  );
}

"use client";

import { withBase } from "@/lib/base-path";

/** dooogs brand mark — arc + three dots */
export function DooogsLogo({
  className = "",
  title = "dooogs",
  invert = false,
}: {
  className?: string;
  title?: string;
  /** White mark for dark backgrounds (preloader). */
  invert?: boolean;
}) {
  const src = withBase(
    invert
      ? "/assets/images/brand/dooogs-mark-white.png"
      : "/assets/images/brand/dooogs-mark.png"
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export + CSS sizing
    <img
      src={src}
      alt={title}
      width={114}
      height={60}
      className={className}
      decoding="async"
    />
  );
}

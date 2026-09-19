"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";

/** dooogs hand-lettered wordmark */
export function DooogsLogo({
  className = "",
  title = "dooogs",
  invert = false,
  badge = false,
}: {
  className?: string;
  title?: string;
  /** White ink for dark backgrounds (preloader). */
  invert?: boolean;
  /** Full black square badge with white wordmark. */
  badge?: boolean;
}) {
  const path = badge
    ? "/assets/images/brand/dooogs-logo.png"
    : invert
      ? "/assets/images/brand/dooogs-mark-white.png"
      : "/assets/images/brand/dooogs-mark.png";
  const [src, setSrc] = useState(path);

  useEffect(() => {
    setSrc(withBase(path));
  }, [path]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export + CSS sizing
    <img
      src={src}
      alt={title}
      width={badge ? 512 : 280}
      height={badge ? 512 : 120}
      className={className}
      decoding="async"
    />
  );
}

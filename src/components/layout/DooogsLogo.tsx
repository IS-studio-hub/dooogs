"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";

/** dooogs particle-dog brand mark */
export function DooogsLogo({
  className = "",
  title = "dooogs",
  invert = false,
  badge = true,
}: {
  className?: string;
  title?: string;
  /** White ink for dark backgrounds. */
  invert?: boolean;
  /** Full black square badge (default — matches source artwork). */
  badge?: boolean;
}) {
  const path = badge
    ? "/assets/images/brand/dooogs-logo.png?v=particle-1"
    : invert
      ? "/assets/images/brand/dooogs-mark-white.png?v=particle-1"
      : "/assets/images/brand/dooogs-mark.png?v=particle-1";
  const [src, setSrc] = useState(path);

  useEffect(() => {
    setSrc(withBase(path));
  }, [path]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export + CSS sizing
    <img
      src={src}
      alt={title}
      width={badge ? 512 : 200}
      height={badge ? 512 : 105}
      className={className}
      decoding="async"
    />
  );
}

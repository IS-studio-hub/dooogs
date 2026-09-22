"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CharacterClip } from "./LisaCharacter";
import { canUseWebGL, isInAppBrowser } from "@/lib/in-app-browser";

/**
 * Lazy-load the heavy Three.js character only in real browsers.
 * Facebook / LinkedIn WebViews OOM-crash (“A problem repeatedly occurred”)
 * if we mount WebGL on first paint.
 */
const LisaCharacter = dynamic(
  () => import("./LisaCharacter").then((m) => m.LisaCharacter),
  { ssr: false, loading: () => <div className="c-lisa_stage" aria-hidden="true" /> }
);

/**
 * Dooogs! media stage — 3D character when safe; plain stage in in-app browsers.
 */
export function LisaMedia({
  clip = "idle",
  useCharacter = true,
}: {
  media?: unknown;
  muted?: boolean;
  clip?: CharacterClip;
  useCharacter?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!useCharacter) {
      setOk(false);
      setReady(true);
      return;
    }
    // Never start WebGL inside Facebook / LinkedIn / Instagram WebViews
    if (isInAppBrowser()) {
      setOk(false);
      setReady(true);
      return;
    }
    // Defer one frame so the shell paints before GPU work
    const id = window.requestAnimationFrame(() => {
      setOk(canUseWebGL());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [useCharacter]);

  if (!ready || !useCharacter || !ok) {
    return <div className="c-lisa_stage" aria-hidden="true" />;
  }

  return <LisaCharacter clip={clip} />;
}

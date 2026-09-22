"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CharacterClip } from "./LisaCharacter";
import { canUseWebGL } from "@/lib/in-app-browser";

/**
 * Lazy-load Three.js after first paint so Safari never OOM-crashes on boot.
 * Same character experience — just deferred + GPU-safe inside LisaCharacter.
 */
const LisaCharacter = dynamic(
  () => import("./LisaCharacter").then((m) => m.LisaCharacter),
  { ssr: false, loading: () => <div className="c-lisa_stage" aria-hidden="true" /> }
);

/**
 * Dooogs! media stage — 3D character on every browser that supports WebGL.
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
    // Wait for idle so the shell + ask bar paint first (critical for Safari)
    const start = () => {
      setOk(canUseWebGL());
      setReady(true);
    };
    let idleId = 0;
    let timeoutId = 0;
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: 900 });
    } else {
      timeoutId = window.setTimeout(start, 250);
    }
    return () => {
      if (idleId && "cancelIdleCallback" in window) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [useCharacter]);

  if (!ready || !useCharacter || !ok) {
    return <div className="c-lisa_stage" aria-hidden="true" />;
  }

  return <LisaCharacter clip={clip} />;
}

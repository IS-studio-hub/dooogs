"use client";

import { useEffect, useState } from "react";
import { LisaCharacter, type CharacterClip } from "./LisaCharacter";
import { canUseWebGL } from "@/lib/in-app-browser";

/**
 * Dooogs! media stage — 3D character.
 * Desktop: mouse look. Mobile/tablet: device-orientation look.
 * Skips WebGL when the browser cannot create a context (common in weak WebViews).
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
  const [ok, setOk] = useState(true);

  useEffect(() => {
    if (!useCharacter) {
      setOk(false);
      return;
    }
    setOk(canUseWebGL());
  }, [useCharacter]);

  if (!useCharacter || !ok) {
    return <div className="c-lisa_stage" aria-hidden="true" />;
  }

  return <LisaCharacter clip={clip} />;
}

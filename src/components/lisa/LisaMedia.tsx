"use client";

import { LisaCharacter, type CharacterClip } from "./LisaCharacter";

/**
 * Dooogs! media stage — 3D character.
 * Desktop: mouse look. Mobile/tablet: device-orientation look.
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
  if (!useCharacter) {
    return <div className="c-lisa_stage" aria-hidden="true" />;
  }

  return <LisaCharacter clip={clip} />;
}

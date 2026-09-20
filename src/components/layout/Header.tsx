"use client";

import type { Locale } from "@/lib/lisa-types";
import { DooogsLogo } from "@/components/layout/DooogsLogo";

const copy = {
  en: {
    talk: "Chat with Dooogs!",
  },
  fr: {
    talk: "Parler à Dooogs!",
  },
} as const;

export function Header({ locale }: { locale: Locale }) {
  const t = copy[locale];

  return (
    <>
      <div className="c-header_bg" aria-hidden="true" />
      <header role="banner">
        <div className="c-header">
          <div className="c-header_logo">
            <span className="c-header_logo_inner">
              <DooogsLogo className="c-header_logo_img" title="Dooogs!" />
            </span>
          </div>

          <p className="c-header_cta">{t.talk}</p>
        </div>
      </header>
    </>
  );
}

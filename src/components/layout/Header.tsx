"use client";

import Link from "next/link";
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
      <div className="c-header_bg" />
      <header>
        <div className="c-header">
          <a
            href={`/${locale}`}
            className="c-header_logo"
            aria-label="dooogs"
          >
            <span className="c-header_logo_inner">
              <DooogsLogo className="c-header_logo_img" />
            </span>
          </a>

          <Link href={`/${locale}`} className="c-header_cta">
            {t.talk}
          </Link>
        </div>
      </header>
    </>
  );
}

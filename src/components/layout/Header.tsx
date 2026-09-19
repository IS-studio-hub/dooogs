"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/lisa-types";

const copy = {
  en: {
    menu: "Menu",
    close: "Close",
    talk: "Chat with Ginny",
    shop: "Shop",
    lang: "Français",
    langHref: "/fr",
  },
  fr: {
    menu: "Menu",
    close: "Fermer",
    talk: "Parler à Ginny",
    shop: "Boutique",
    lang: "English",
    langHref: "/en",
  },
} as const;

export function Header({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.classList.toggle("has-menu-opened", open);
    return () => document.documentElement.classList.remove("has-menu-opened");
  }, [open]);

  return (
    <>
      <div className="c-header_bg" />
      <header>
        <div className="c-header">
          <a
            href="https://drinkginny.com/"
            className="c-header_logo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="c-header_logo_inner">Ginny</span>
          </a>

          <span aria-hidden="true" className="c-header_icon">
            <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
              <path
                d="M2 12C6 4 11 2 14 2s8 2 12 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="8" cy="11" r="1.5" fill="currentColor" />
              <circle cx="14" cy="11" r="1.5" fill="currentColor" />
              <circle cx="20" cy="11" r="1.5" fill="currentColor" />
            </svg>
          </span>

          <Link href={`/${locale}`} className="c-header_cta">
            {t.talk}
          </Link>

          <button
            type="button"
            className="c-header_menu-toggler"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Navigation mobile"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t.close : t.menu}
          </button>
        </div>

        <nav
          className="c-menu"
          id="mobile-menu"
          aria-label="Navigation mobile"
        >
          <div className="c-menu_inner">
            <ul className="c-menu_nav">
              <li className="c-menu_nav_item">
                <Link
                  href={`/${locale}`}
                  className="c-menu_nav_link"
                  onClick={() => setOpen(false)}
                >
                  {t.talk}
                </Link>
              </li>
              <li className="c-menu_nav_item">
                <a
                  className="c-menu_nav_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://drinkginny.com/"
                >
                  {t.shop}
                </a>
              </li>
            </ul>

            <div className="c-menu_footer">
              <Link
                href={t.langHref}
                className="c-menu_langswitcher"
                onClick={() => setOpen(false)}
              >
                {t.lang}
              </Link>
              <span className="c-menu_location">
                <span className="u-screen-reader-text">Canada</span>
                <span aria-hidden="true">🇨🇦</span>
              </span>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

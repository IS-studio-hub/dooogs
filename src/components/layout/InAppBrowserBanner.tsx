"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/lisa-types";
import { isInAppBrowser } from "@/lib/in-app-browser";

const copy = {
  en: {
    text: "LinkedIn’s browser limits 3D and sound. Open in Safari or Chrome for the full experience.",
    open: "Open in browser",
    copyLink: "Copy link",
    copied: "Link copied",
    dismiss: "Dismiss",
  },
  fr: {
    text: "Le navigateur LinkedIn limite la 3D et le son. Ouvre dans Safari ou Chrome pour l’expérience complète.",
    open: "Ouvrir dans le navigateur",
    copyLink: "Copier le lien",
    copied: "Lien copié",
    dismiss: "Fermer",
  },
} as const;

const DISMISS_KEY = "dooogs_inapp_banner_dismissed";

export function InAppBrowserBanner({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = copy[locale] ?? copy.en;

  useEffect(() => {
    if (!isInAppBrowser()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const url = typeof window !== "undefined" ? window.location.href : "";

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <aside className="c-inapp" role="status">
      <p className="c-inapp_text">{t.text}</p>
      <div className="c-inapp_actions">
        <a className="c-inapp_btn -primary" href={url} target="_blank" rel="noopener noreferrer">
          {t.open}
        </a>
        <button type="button" className="c-inapp_btn -secondary" onClick={() => void copyUrl()}>
          {copied ? t.copied : t.copyLink}
        </button>
        <button type="button" className="c-inapp_btn -ghost" onClick={dismiss}>
          {t.dismiss}
        </button>
      </div>
    </aside>
  );
}

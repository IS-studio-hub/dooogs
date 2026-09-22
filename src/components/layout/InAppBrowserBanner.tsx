"use client";

import { useEffect, useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import type { Locale } from "@/lib/lisa-types";
import {
  copyTextToClipboard,
  isAndroid,
  isIOS,
  isInAppBrowser,
  tryOpenInExternalBrowser,
} from "@/lib/in-app-browser";

const copy = {
  en: {
    text: "This in-app browser limits 3D and sound. Open in Safari or Chrome for the full experience.",
    open: "Open in browser",
    copyLink: "Copy link",
    copied: "Link copied — paste it in Safari or Chrome",
    tipIos: "Or tap ⋯ / Share → Open in Safari",
    tipAndroid: "Or tap ⋮ → Open in Chrome / Browser",
    dismiss: "Dismiss",
  },
  fr: {
    text: "Ce navigateur intégré limite la 3D et le son. Ouvre Safari ou Chrome pour l’expérience complète.",
    open: "Ouvrir dans le navigateur",
    copyLink: "Copier le lien",
    copied: "Lien copié — colle-le dans Safari ou Chrome",
    tipIos: "Ou appuie sur ⋯ / Partager → Ouvrir dans Safari",
    tipAndroid: "Ou appuie sur ⋮ → Ouvrir dans Chrome",
    dismiss: "Fermer",
  },
} as const;

const DISMISS_KEY = "dooogs_inapp_banner_dismissed";

export function InAppBrowserBanner({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const t = copy[locale] ?? copy.en;

  const tip = useMemo(() => {
    if (typeof navigator === "undefined") return t.tipIos;
    if (isAndroid()) return t.tipAndroid;
    if (isIOS()) return t.tipIos;
    return t.tipIos;
  }, [t]);

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
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      setHint(t.copied);
      window.setTimeout(() => {
        setCopied(false);
        setHint(null);
      }, 3500);
    } else {
      setHint(tip);
    }
  }

  async function openExternal(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Always copy first so the user can paste if the WebView blocks escape
    void copyTextToClipboard(url);
    const tried = tryOpenInExternalBrowser(url);
    // If still here after a beat, show how to leave the in-app browser
    window.setTimeout(() => {
      setHint(tried ? tip : t.copied);
      setCopied(true);
    }, 900);
  }

  return (
    <aside className="c-inapp" role="status">
      <p className="c-inapp_text">{t.text}</p>
      {hint ? <p className="c-inapp_hint">{hint}</p> : <p className="c-inapp_hint">{tip}</p>}
      <div className="c-inapp_actions">
        <button type="button" className="c-inapp_btn -primary" onClick={(e) => void openExternal(e)}>
          {t.open}
        </button>
        <button type="button" className="c-inapp_btn -secondary" onClick={() => void copyUrl()}>
          {copied ? t.copied.split("—")[0]?.trim() || t.copied : t.copyLink}
        </button>
        <button type="button" className="c-inapp_btn -ghost" onClick={dismiss}>
          {t.dismiss}
        </button>
      </div>
    </aside>
  );
}

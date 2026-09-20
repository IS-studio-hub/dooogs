"use client";

import { withBase } from "@/lib/base-path";
import type { Locale } from "@/lib/lisa-types";

const copy = {
  en: {
    brand: "dooogs OS",
    headline: "Your computer, on call.",
    lede: "A local Jarvis for this Mac — voice chat, always-on MCP connectors, and permission popups before anything sensitive runs. Built on the Ginny data and tools you already use.",
    download: "Download for Mac",
    secondary: "Open live Ginny guide",
    featuresTitle: "What ships today",
    features: [
      "Local desktop app with chat + microphone",
      "Always-warm MCP hub (Blender, Unreal, Terminal, GitHub, Chrome…)",
      "Permission popups for every sensitive action — allow and continue",
      "Connectors ready for Figma, Adobe, Spotify, WhatsApp, Cursor, Apple/iOS when you grant access",
      "Uses your existing OpenAI key and project data",
    ],
    note: "Adobe, WhatsApp, Spotify, Figma, and iOS connectors appear as pending until you approve setup. The agent will ask — it won’t stop the conversation.",
  },
  fr: {
    brand: "dooogs OS",
    headline: "Ton ordinateur, à l’écoute.",
    lede: "Un Jarvis local pour ce Mac — chat vocal, MCP toujours connectés, et pop-ups d’autorisation avant chaque action sensible. Branché sur les données Ginny déjà créées.",
    download: "Télécharger pour Mac",
    secondary: "Ouvrir le guide Ginny",
    featuresTitle: "Inclus maintenant",
    features: [
      "App bureau locale avec chat + micro",
      "Hub MCP toujours actif (Blender, Unreal, Terminal, GitHub, Chrome…)",
      "Pop-ups d’autorisation pour chaque action sensible",
      "Connecteurs Figma, Adobe, Spotify, WhatsApp, Cursor, Apple/iOS quand tu autorises",
      "Utilise ta clé OpenAI et tes données existantes",
    ],
    note: "Les connecteurs Adobe, WhatsApp, Spotify, Figma et iOS restent en attente jusqu’à ta confirmation. L’agent demande — il n’arrête pas la conversation.",
  },
} as const;

export function ProductLanding({ locale }: { locale: Locale }) {
  const t = copy[locale] || copy.en;
  const downloadHref = "https://github.com/IS-studio-hub/dooogs/releases/latest/download/dooogs-os-mac.zip";
  const demoHref = withBase(`/${locale}/guide`);

  return (
    <div className="c-product">
      <section className="c-product_hero">
        <p className="c-product_brand">{t.brand}</p>
        <h1 className="c-product_title">{t.headline}</h1>
        <p className="c-product_lede">{t.lede}</p>
        <div className="c-product_cta">
          <a className="c-product_download" href={downloadHref} download>
            {t.download}
          </a>
          <a className="c-product_link" href={demoHref}>
            {t.secondary}
          </a>
        </div>
      </section>

      <section className="c-product_features">
        <h2>{t.featuresTitle}</h2>
        <ul>
          {t.features.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="c-product_note">{t.note}</p>
      </section>
    </div>
  );
}

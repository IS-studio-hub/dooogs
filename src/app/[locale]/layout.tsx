import { CookieConsent } from "@/components/layout/CookieConsent";
import { Header } from "@/components/layout/Header";
import { HtmlLang } from "@/components/layout/HtmlLang";
import { Preloader } from "@/components/layout/Preloader";
import type { Locale } from "@/lib/lisa-types";
import { notFound } from "next/navigation";

const locales: Locale[] = ["en", "fr"];

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;

  return (
    <>
      <HtmlLang locale={locale} />
      <Preloader />
      <Header locale={locale} />
      <main>{children}</main>
      <CookieConsent locale={locale} />
    </>
  );
}

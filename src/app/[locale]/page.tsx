import { ProductLanding } from "@/components/product/ProductLanding";
import type { Locale } from "@/lib/lisa-types";
import { notFound } from "next/navigation";

const locales: Locale[] = ["en", "fr"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  return <ProductLanding locale={raw as Locale} />;
}

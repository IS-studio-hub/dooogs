import type { Metadata } from "next";
import { Schibsted_Grotesk, Outfit } from "next/font/google";
import "./globals.css";

const ui = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui-family",
  display: "swap",
});

const display = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "dooogs OS | Local Jarvis for your Mac",
  description:
    "Download dooogs OS — a local voice assistant with always-on MCP connectors, permission popups, and your existing project data.",
  metadataBase: new URL("https://is-studio-hub.github.io/dooogs"),
  openGraph: {
    title: "dooogs OS",
    description:
      "Local Jarvis for Mac: voice chat, MCP hub, and allow/deny access popups.",
    siteName: "dooogs OS",
  },
  twitter: {
    card: "summary_large_image",
    title: "dooogs OS",
    description:
      "Local Jarvis for Mac: voice chat, MCP hub, and allow/deny access popups.",
  },
  icons: {
    icon: [
      { url: "/assets/images/favicons/favicon-32x32.png", sizes: "32x32" },
      { url: "/assets/images/favicons/favicon-16x16.png", sizes: "16x16" },
    ],
    apple: "/assets/images/favicons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="lisa" data-template="lisa" className={`${ui.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}

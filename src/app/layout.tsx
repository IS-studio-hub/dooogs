import type { Metadata, Viewport } from "next";
import Script from "next/script";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: "Dooogs! | Dog Types Guide",
  description:
    "Meet Dooogs! — your poodle guide to dog breeds. Explore types, history, and where to see more of each breed.",
  metadataBase: new URL("https://is-studio-hub.github.io/dooogs"),
  applicationName: "Dooogs!",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    title: "Dooogs! | Dog Types Guide",
    description:
      "Explore dog breeds with Dooogs! — traits, history, and where to meet each type.",
    siteName: "Dooogs!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dooogs! | Dog Types Guide",
    description:
      "Explore dog breeds with Dooogs! — traits, history, and where to meet each type.",
  },
  icons: {
    icon: [
      { url: "/assets/images/favicons/favicon-32x32.png", sizes: "32x32" },
      { url: "/assets/images/favicons/favicon-16x16.png", sizes: "16x16" },
    ],
    apple: "/assets/images/favicons/apple-touch-icon.png",
  },
  other: {
    "X-Content-Type-Options": "nosniff",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="lisa"
      data-template="lisa"
      className={`${ui.variable} ${display.variable}`}
    >
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </head>
      <body>
        {children}
        <Script
          src="https://lytico-production.up.railway.app/lytico.js"
          strategy="afterInteractive"
          data-site="lt_dooogs_is02"
        />
      </body>
    </html>
  );
}

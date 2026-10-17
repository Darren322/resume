import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import { deskModels, fullDeskMedia, lightDeskMedia, site, siteUrl } from "./site";
import "../styles.css";

// One characterful sans for all interface and headings; a hand for notes and tape.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", axes: ["opsz", "wdth"] });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand" });
// The laptop's editor face.
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: site.title,
  description: site.description,
  applicationName: `${site.name} — Resume`,
  authors: [{ name: site.fullName, url: siteUrl }],
  creator: site.fullName,
  keywords: [
    "Darren Ng",
    "Darren Ng Yijie",
    "software engineer Singapore",
    "SMU software engineering",
    "full-stack developer",
    "Next.js",
    "Spring Boot",
    "AWS",
    "resume",
    "portfolio",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: "/",
    siteName: `${site.name} — Resume`,
    title: site.title,
    description: site.description,
    locale: "en_SG",
    firstName: "Darren",
    lastName: "Ng",
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#070b12",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Start the desk download with the HTML; each device fetches only the variant it will load.
  preload(deskModels.light, { as: "fetch", crossOrigin: "anonymous", media: lightDeskMedia });
  preload(deskModels.full, { as: "fetch", crossOrigin: "anonymous", media: fullDeskMedia });
  return (
    <html lang="en" className={`${display.variable} ${hand.variable} ${code.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

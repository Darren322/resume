import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "../styles.css";

// One characterful sans for all interface and headings; a hand for notes and tape.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", axes: ["opsz", "wdth"] });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand" });
// The laptop's editor face.
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });

export const metadata: Metadata = {
  title: "Darren Ng — Software Engineer",
  description:
    "Explore Darren Ng's software engineering work, projects, teaching, and technical skills in an interactive career studio.",
};

export const viewport: Viewport = {
  themeColor: "#070b12",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${hand.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  );
}

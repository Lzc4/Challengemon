import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";

const pixel = Pixelify_Sans({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-pixel", display: "swap" });

export const viewport = { themeColor: "#0e1114" };

export const metadata: Metadata = {
  title: "Challengemon",
  description: "Nuzlocke- und Soullocke-Runs im Browser, mit deinen eigenen Spielen und deinem eigenen Speicher",
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" translate="no" className={`${pixel.variable} notranslate`}>
      <body>{children}</body>
    </html>
  );
}

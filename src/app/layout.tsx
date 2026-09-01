import type { Metadata } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { ConditionalHeader } from "@/components/ConditionalHeader";
import { ConditionalFooter } from "@/components/ConditionalFooter";

// Didone display face, matching the wordmark. CLAUDE.md §8.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Geometric sans for body, UI, and the tracked-out label style.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://flare-rgv.vercel.app"),
  title: {
    default: "FLARE: Financial Literacy Advancement for RGV Equity",
    template: "%s | FLARE",
  },
  description:
    "A student-run video library explaining financial literacy, taxes, and economics, sorted by difficulty so you can find the version pitched at you.",
  openGraph: {
    title: "FLARE: Financial Literacy Advancement for RGV Equity",
    description:
      "A student-run video library explaining financial literacy, taxes, and economics, sorted by difficulty.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${jost.variable} h-full antialiased`}
    >
      <body>
        <ConditionalHeader>
          <SiteHeader />
        </ConditionalHeader>
        {/*
          Not flex-1. That stretched main to fill exactly the space left in the
          viewport, which parked the footer at the bottom of the screen and made
          it visible on any short page: the 404, a profile with no videos, an
          empty dashboard.

          A full viewport less the 4rem header means the footer always starts
          below the fold and has to be scrolled to, which is what a footer is
          for. Pages with real content push it further down as normal.
        */}
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <ConditionalFooter />
      </body>
    </html>
  );
}

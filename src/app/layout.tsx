import type { Metadata } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { ConditionalHeader } from "@/components/ConditionalHeader";
import { ConditionalFooter } from "@/components/ConditionalFooter";
import { SiteFooter } from "@/components/SiteFooter";

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

const SITE = "https://ibflare.vercel.app";

const SHARE_TITLE = "FLARE: Financial Literacy Advancement for RGV Equity";
const SHARE_DESCRIPTION =
  "A student-run video library explaining financial literacy, taxes, and economics, sorted by difficulty.";

export const metadata: Metadata = {
  /*
   * The deployed origin, and it has to be right for more than tidiness: every
   * relative URL in this object is resolved against it, so the share image
   * below becomes an absolute URL from this value. It previously read
   * flare-rgv.vercel.app, which is not this site and answers 404, meaning a
   * shared link pointed a scraper at a dead host.
   *
   * Replace this when there is a real domain. The privacy policy's
   * flare.example.org placeholder has to change in the same commit.
   */
  metadataBase: new URL(SITE),
  title: {
    default: SHARE_TITLE,
    template: "%s | FLARE",
  },
  description:
    "A student-run video library explaining financial literacy, taxes, and economics, sorted by difficulty so you can find the version pitched at you.",
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    type: "website",
    siteName: "FLARE",
    url: SITE,
    locale: "en_US",
    /*
     * This is what iMessage, WhatsApp, Instagram, Discord and Slack render.
     * Width and height are stated rather than left to be discovered: a
     * scraper that has not downloaded the file yet uses them to lay out the
     * card, and some show nothing at all without them.
     */
    images: [
      {
        url: "/images/flare1200630.png",
        width: 1200,
        height: 630,
        alt: "The FLARE wordmark, a flame containing a dollar sign, over the words Financial Literacy Advancement for RGV Equity.",
      },
    ],
  },
  /*
   * twitter:card is not implied by having an image. Without it the card
   * defaults to a small square thumbnail beside the text instead of the wide
   * image. There is no separate twitter:image here on purpose: X falls back to
   * og:image, so a second copy would be one more thing to keep in step.
   */
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
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
        <ConditionalFooter>
          <SiteFooter />
        </ConditionalFooter>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
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
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginPanel } from "./LoginPanel";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  // Blank tells the callback to resolve the destination from the account.
  const next = typeof params.next === "string" ? params.next : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (next.startsWith("/") && !next.startsWith("//")) redirect(next);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, onboarded")
      .eq("id", user.id)
      .maybeSingle();

    redirect(profile?.onboarded ? `/u/${profile.username}` : "/onboarding");
  }

  return (
    // min-h-screen, not viewport-less-header: this page has no header.
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/*
        The landing page's hero footage, reused. Same file, so it is already
        cached for anyone arriving from the landing page and costs no new
        asset. Decorative: muted, looping, aria-hidden and untabbable, since it
        says nothing a screen reader needs.

        Over it, the full lockup and one line of copy taken from the landing
        page. Nothing else. This is a sign-in page, not a pitch.
      */}
      <div className="relative isolate hidden flex-col justify-between overflow-hidden bg-ink px-12 py-14 text-mist lg:flex xl:px-16 xl:py-16">
        <video
          className="absolute inset-0 -z-20 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hero-poster.jpg"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
        <div className="panel-scrim absolute inset-0 -z-10" aria-hidden />

        <Link href="/" aria-label="FLARE, home" className="block max-w-md">
          <Image
            src="/images/FLARE_LOGO_MIST.png"
            alt="FLARE, Financial Literacy Advancement for RGV Equity"
            width={2172}
            height={724}
            priority
            className="w-full"
          />
        </Link>

        <p className="font-display max-w-md text-3xl leading-tight font-medium text-balance">
          Answer a question once, and the next person doesn&rsquo;t have to
          start from nothing.
        </p>

        <p className="label text-mist/40">FLARE at Lamar Academy</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-14">
        {/* The only way home once the left panel is hidden and the nav is gone. */}
        <Link
          href="/"
          aria-label="FLARE, home"
          className="mb-12 block w-fit lg:hidden"
        >
          <Image
            src="/images/FLARE_WORDMARK.png"
            alt="FLARE"
            width={1993}
            height={517}
            className="h-7 w-auto"
          />
        </Link>

        <div className="flex flex-1 items-center lg:flex-none">
          <LoginPanel next={next} error={error} />
        </div>
      </div>
    </div>
  );
}

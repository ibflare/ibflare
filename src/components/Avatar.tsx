"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/profiles";

/**
 * Every avatar on the site renders through this.
 *
 * It is a client component for one reason: the fallback has to survive the
 * image failing to load, and that is only knowable in the browser. Google
 * avatar URLs are not stable. They stop resolving when someone changes their
 * Google photo, and the profile row keeps the dead URL until that person signs
 * in again. Without onError the result is a broken-image glyph on a public
 * profile, so initials have to be reachable from a load failure and not only
 * from a null src.
 *
 * `unoptimized` because these are already 400x400 at most, and because it
 * avoids having to allowlist two remote hosts in next.config.ts for images
 * that the optimizer would have nothing to do.
 */
export function Avatar({
  src,
  displayName,
  px,
  className = "",
}: {
  src: string | null;
  displayName: string;
  /** Intrinsic pixel size to request. Display size comes from className. */
  px: number;
  className?: string;
}) {
  /*
   * Which src failed, rather than a boolean.
   *
   * A new src is a new attempt: replacing a picture that had failed must show
   * the new one, not stay on the fallback. Storing the failed URL and comparing
   * gets that for free, where a boolean would need resetting from an effect,
   * which is what react-hooks/set-state-in-effect exists to stop.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const showImage = src !== null && failedSrc !== src;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-ink/8 ${className}`}
    >
      {showImage ? (
        <Image
          src={src}
          alt=""
          width={px}
          height={px}
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
          unoptimized
        />
      ) : (
        <span
          className="font-display absolute inset-0 flex items-center justify-center font-medium text-ink/35"
          // Sized off the box rather than a fixed step, so one component
          // serves a 28px comment avatar and a 112px profile one.
          style={{ fontSize: `${Math.round(px * 0.34)}px` }}
          aria-hidden
        >
          {initials(displayName)}
        </span>
      )}
    </div>
  );
}

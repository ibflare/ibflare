"use client";

import Image from "next/image";
import { useState } from "react";
import { embedUrl } from "@/lib/youtube";

/**
 * Thumbnail first, iframe on click. CLAUDE.md section 5.
 *
 * The point is that the iframe is not mounted until someone asks for it. A
 * YouTube embed pulls several hundred kilobytes of player and sets cookies the
 * moment it exists, so a library page that mounted one per visit would be
 * paying that on every view of every page, for a video most visitors will not
 * play. youtube-nocookie is the host either way.
 *
 * autoplay=1 is in the embed URL because the click that mounts the iframe is
 * the click that means "play". Without it a viewer has to click twice.
 */
export function Player({
  youtubeId,
  title,
  thumbnailUrl,
}: {
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          src={embedUrl(youtubeId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-ink/10"
    >
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt=""
          width={1280}
          height={720}
          priority
          className="size-full object-cover"
          unoptimized
        />
      )}

      <span className="absolute inset-0 bg-ink/20 transition-colors group-hover:bg-ink/10" />

      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-ink/85 text-mist transition-transform group-hover:scale-105 sm:size-20">
          {/* Drawn rather than an icon dependency, as with the nav. */}
          <svg
            width="22"
            height="26"
            viewBox="0 0 22 26"
            aria-hidden
            focusable="false"
            className="ml-1"
          >
            <path d="M0 0 L22 13 L0 26 Z" fill="currentColor" />
          </svg>
        </span>
      </span>
    </button>
  );
}

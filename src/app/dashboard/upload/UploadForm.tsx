"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { createVideo, type UploadState } from "./actions";
import {
  DIFFICULTY_LEVELS,
  TOPICS,
  TOPIC_LABELS,
  difficultyAccent,
} from "@/lib/taxonomy";
import { formatDuration } from "@/lib/youtube";

const EMPTY: UploadState = {
  errors: {},
  values: {
    url: "",
    title: "",
    description: "",
    difficulty: "",
    topic: "",
    collaborators: "",
  },
};

type Resolved = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  durationS: number | null;
};

export function UploadForm() {
  const [state, submit, submitting] = useActionState(createVideo, EMPTY);

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  /*
   * Resolve on blur and on paste rather than on every keystroke. Section 5
   * wants this to happen before the form can be submitted, and each call costs
   * a unit of the daily quota, so firing per character would be wasteful and
   * would race itself.
   */
  function check(url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      setResolved(null);
      setLinkError(null);
      return;
    }

    startChecking(async () => {
      setLinkError(null);
      try {
        const response = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          setResolved(null);
          setLinkError(data.message ?? data.error ?? "We could not check that link.");
          return;
        }

        setResolved(data.video);

        // Prefill the title, but never overwrite one already edited.
        const field = titleRef.current;
        if (field && !field.value.trim()) field.value = data.video.title;
      } catch {
        setResolved(null);
        setLinkError("We couldn't reach YouTube to check that link. Try again in a moment.");
      }
    });
  }

  const urlError = linkError ?? state.errors.url;
  const duration = formatDuration(resolved?.durationS ?? null);

  return (
    <form action={submit} className="mt-12 space-y-10">
      {state.errors.form && (
        <p
          role="alert"
          className="rounded-lg border border-hot/40 bg-hot/5 px-5 py-4 text-sm leading-relaxed"
        >
          {state.errors.form}
        </p>
      )}

      <div>
        <label htmlFor="url" className="label block text-ink/60">
          YouTube link
        </label>
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          required
          defaultValue={state.values.url}
          onBlur={(e) => check(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            // The input has not updated yet at paste time.
            setTimeout(() => check(pasted), 0);
          }}
          aria-describedby={urlError ? "url-error" : undefined}
          aria-invalid={urlError ? true : undefined}
          placeholder="https://www.youtube.com/watch?v=..."
          className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        />
        {checking && (
          <p className="mt-2 text-sm text-ink/55">Checking that link</p>
        )}
        {urlError && (
          <p id="url-error" role="alert" className="mt-2 text-sm text-hot">
            {urlError}
          </p>
        )}
      </div>

      {/* Section 5: a live thumbnail, so they can confirm it is the right video. */}
      {resolved && (
        <div className="flex flex-col gap-5 rounded-lg border border-ink/12 bg-paper-deep/50 p-5 sm:flex-row sm:items-center">
          <Image
            src={resolved.thumbnailUrl}
            alt=""
            width={240}
            height={180}
            className="w-full shrink-0 rounded-md object-cover sm:w-40"
            unoptimized
          />
          <div className="min-w-0">
            <p className="label text-ink/45">Found on YouTube</p>
            <p className="font-display mt-2 text-lg leading-snug font-medium">
              {resolved.title}
            </p>
            <p className="mt-2 text-sm text-ink/55">
              {duration ?? "Length unavailable"}
            </p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="title" className="label block text-ink/60">
          Title
        </label>
        <p id="title-hint" className="mt-2 text-sm leading-relaxed text-ink/55">
          Taken from YouTube. Edit it if the video&rsquo;s own title is not the
          clearest name for it here.
        </p>
        <input
          ref={titleRef}
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={state.values.title}
          aria-describedby={
            state.errors.title ? "title-hint title-error" : "title-hint"
          }
          aria-invalid={state.errors.title ? true : undefined}
          className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        />
        {state.errors.title && (
          <p id="title-error" role="alert" className="mt-2 text-sm text-hot">
            {state.errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="label block text-ink/60">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={5000}
          defaultValue={state.values.description}
          aria-describedby={state.errors.description ? "description-error" : undefined}
          className="mt-3 w-full resize-y rounded-lg border border-ink/25 bg-paper px-4 py-3 leading-relaxed text-ink"
        />
        {state.errors.description && (
          <p id="description-error" role="alert" className="mt-2 text-sm text-hot">
            {state.errors.description}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="label text-ink/60">Level</legend>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          What the video assumes the viewer already knows.
        </p>
        <div className="mt-4 space-y-px overflow-hidden rounded-lg bg-ink/12">
          {DIFFICULTY_LEVELS.map((level) => (
            <label
              key={level.level}
              className="flex cursor-pointer items-start gap-4 bg-paper px-5 py-4 has-checked:bg-paper-deep"
            >
              <input
                type="radio"
                name="difficulty"
                value={level.level}
                defaultChecked={state.values.difficulty === String(level.level)}
                className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
              />
              <span className="min-w-0">
                <span
                  className="font-display block leading-none font-medium"
                  style={{ color: difficultyAccent(level.level) }}
                >
                  {level.level}. {level.name}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-ink/70">
                  {level.assumes}
                </span>
              </span>
            </label>
          ))}
        </div>
        {state.errors.difficulty && (
          <p role="alert" className="mt-2 text-sm text-hot">
            {state.errors.difficulty}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="topic" className="label block text-ink/60">
          Topic
        </label>
        <select
          id="topic"
          name="topic"
          required
          defaultValue={state.values.topic}
          aria-describedby={state.errors.topic ? "topic-error" : undefined}
          className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        >
          <option value="">Choose one</option>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {TOPIC_LABELS[topic]}
            </option>
          ))}
        </select>
        {state.errors.topic && (
          <p id="topic-error" role="alert" className="mt-2 text-sm text-hot">
            {state.errors.topic}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="collaborators" className="label block text-ink/60">
          Anyone you made it with
        </label>
        <p id="collaborators-hint" className="mt-2 text-sm leading-relaxed text-ink/55">
          Usernames, separated by commas. They each get a tag to accept, and
          their name joins the byline once they do. You can change this later
          from your dashboard.
        </p>
        <input
          id="collaborators"
          name="collaborators"
          type="text"
          defaultValue={state.values.collaborators}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="collaborators-hint"
          placeholder="maya_r, andre_l"
          className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        />
      </div>

      {/*
        Section 9.5. Worded as a record of releases that exist rather than as
        the release itself, which is what the spec asks for.
      */}
      <div className="rounded-lg border border-ink/12 bg-paper-deep/50 p-6">
        <label htmlFor="release" className="flex items-start gap-3">
          <input
            id="release"
            name="release"
            type="checkbox"
            required
            aria-describedby={state.errors.release ? "release-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="text-sm leading-relaxed text-ink/75">
            Everyone who appears or speaks in this video has agreed to it being
            posted publicly, and for anyone under 18 a signed release is on file
            with FLARE. This box is a record that those releases exist, not a
            replacement for collecting them.
          </span>
        </label>
        {state.errors.release && (
          <p id="release-error" role="alert" className="mt-3 text-sm text-hot">
            {state.errors.release}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <button
          type="submit"
          disabled={submitting || checking}
          className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Publishing" : "Publish"}
        </button>
        <Link
          href="/contribute"
          className="text-sm text-ink/55 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
        >
          How to post a video
        </Link>
      </div>
    </form>
  );
}

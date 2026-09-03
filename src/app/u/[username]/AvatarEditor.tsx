"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { uploadAvatar, removeAvatar, type AvatarState } from "./actions";

const EMPTY: AvatarState = { error: null };

/**
 * The avatar, plus the controls the owner gets over it.
 *
 * Only rendered for someone looking at their own profile with can_post, so
 * this component does not decide who may edit; the page does, and the storage
 * policies do again underneath.
 *
 * The controls appear on hover, per the brief, but hover is not the only way in:
 *
 *   - focus-within reveals them, so they are reachable by keyboard rather than
 *     being invisible until a pointer arrives
 *   - (hover: none) keeps them visible, because a phone has no hover state and
 *     a control that only exists on hover does not exist on a phone
 *
 * The file input is the native one, hidden and driven by a button, because a
 * bare file input cannot be styled and its "No file chosen" text is noise.
 */
export function AvatarEditor({
  src,
  displayName,
}: {
  src: string | null;
  displayName: string;
}) {
  const [uploadState, upload, uploading] = useActionState(uploadAvatar, EMPTY);
  const [removeState, remove, removing] = useActionState(removeAvatar, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  const [tooBig, setTooBig] = useState(false);

  const busy = uploading || removing;
  const error = tooBig
    ? "That image is over 2MB. Pick a smaller one."
    : uploadState.error ?? removeState.error;

  return (
    <div className="shrink-0">
      <form ref={formRef} action={upload} className="group relative block">
        <Avatar
          src={src}
          displayName={displayName}
          px={112}
          className="size-24 sm:size-28"
        />

        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-ink/70 text-mist transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
            busy ? "opacity-100" : "opacity-0"
          }`}
        >
          {busy ? (
            <span className="label">Saving</span>
          ) : (
            <>
              <label
                htmlFor="avatar-file"
                className="label cursor-pointer px-2 text-center underline decoration-mist/40 underline-offset-4 hover:decoration-mist"
              >
                Change
              </label>
              {src && (
                <button
                  type="submit"
                  formAction={remove}
                  className="label px-2 text-mist/70 underline decoration-transparent underline-offset-4 transition-colors hover:text-mist hover:decoration-mist/60"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>

        <input
          id="avatar-file"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Checked again on the server, which is the check that counts.
            // This one exists so a 40MB photo fails instantly instead of
            // after uploading 40MB.
            if (file.size > 2 * 1024 * 1024) {
              setTooBig(true);
              e.target.value = "";
              return;
            }

            setTooBig(false);
            formRef.current?.requestSubmit();
          }}
        />
      </form>

      {error && (
        <p role="alert" className="mt-3 max-w-56 text-sm leading-relaxed text-hot">
          {error}
        </p>
      )}
    </div>
  );
}

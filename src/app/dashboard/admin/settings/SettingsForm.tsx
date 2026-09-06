"use client";

import { useActionState } from "react";
import { saveSiteSettings } from "../actions";
import { EMPTY_ACTION } from "../../actions";

/**
 * The two kill switches. Section 4.
 *
 * One form, one save, both switches submitted together, because
 * set_site_settings takes both and writes one audit row for the change. Two
 * independent toggles that each fired on click would give a log full of
 * single-field flips and no way to tell a deliberate change from a misclick.
 */
export function SettingsForm({
  commentsEnabled,
  signupsEnabled,
  updatedAt,
  updatedByName,
}: {
  commentsEnabled: boolean;
  signupsEnabled: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}) {
  const [state, save, saving] = useActionState(saveSiteSettings, EMPTY_ACTION);

  return (
    <form action={save} className="mt-8 max-w-xl space-y-8">
      <Switch
        id="comments_enabled"
        name="comments_enabled"
        defaultChecked={commentsEnabled}
        label="Comments are on"
        help="Turning this off hides every comment on the site and refuses new ones. Existing comments are kept and come back when it is turned on again."
      />

      <Switch
        id="signups_enabled"
        name="signups_enabled"
        defaultChecked={signupsEnabled}
        label="New accounts are allowed"
        help="Turning this off stops anyone creating an account. People who already have one can still sign in."
      />

      <div className="flex flex-wrap items-center gap-4 border-t border-ink/10 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="label rounded-full bg-ink px-6 py-3.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving" : "Save"}
        </button>
        {state.ok && !state.error && (
          <span className="label text-ink/50">Saved</span>
        )}
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-hot/40 bg-hot/5 px-4 py-3 text-sm leading-relaxed"
        >
          {state.error}
        </p>
      )}

      {updatedAt && (
        <p className="text-sm text-ink/50">
          Last changed{" "}
          {new Date(updatedAt).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {updatedByName ? ` by ${updatedByName}` : ""}.
        </p>
      )}
    </form>
  );
}

function Switch({
  id,
  name,
  label,
  help,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  help: string;
  defaultChecked: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
        />
        <span className="font-medium">{label}</span>
      </label>
      <p className="mt-1.5 ml-7 text-sm leading-relaxed text-ink/55">{help}</p>
    </div>
  );
}

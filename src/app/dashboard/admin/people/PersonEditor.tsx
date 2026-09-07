"use client";

import { useActionState, useState } from "react";
import { savePermissions, suspendUser, unsuspendUser } from "../actions";
import { EMPTY_ACTION } from "@/lib/action-state";

export type Person = {
  id: string;
  username: string;
  display_name: string;
  title: string | null;
  role: string;
  can_post: boolean;
  can_moderate: boolean;
  can_manage_users: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  email: string | null;
};

const ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "member", label: "Member" },
  { value: "officer", label: "Officer" },
  { value: "sponsor", label: "Sponsor" },
];

/**
 * One person, one editor. Section 7 is explicit about the shape of this: a
 * title field, a role dropdown, three checkboxes labelled in plain language
 * rather than field names, and a line under each saying what it actually
 * allows. No bulk actions, no inline table editing.
 *
 * Collapsed until clicked, because a sponsor searching for one student should
 * see a list of names, not eight forms.
 */
export function PersonEditor({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const [save, saveAction, saving] = useActionState(
    savePermissions,
    EMPTY_ACTION,
  );
  const [susp, suspendAction, suspending] = useActionState(
    suspendUser,
    EMPTY_ACTION,
  );
  const [unsusp, unsuspendAction, unsuspending] = useActionState(
    unsuspendUser,
    EMPTY_ACTION,
  );

  // Local, so ticking the moderate box shows its warning before saving.
  const [moderate, setModerate] = useState(person.can_moderate);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState("");

  const error = save.error ?? susp.error ?? unsusp.error;
  const saved = save.ok && !save.error;

  return (
    <li className="rounded-2xl border border-ink/15 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left"
      >
        <span className="font-display text-lg leading-snug font-medium">
          {person.display_name}
        </span>
        <span className="text-sm text-ink/50">@{person.username}</span>
        {/*
          A title identical to the role is not worth two chips. ibflare has
          role "sponsor" and title "Sponsor", which read as "SPONSOR SPONSOR"
          side by side. Compared case-insensitively and trimmed, since the
          title is free text a sponsor types.
        */}
        {person.title &&
          person.title.trim().toLowerCase() !== person.role.toLowerCase() && (
            <span className="label text-ink/45">{person.title}</span>
          )}
        <span className="label text-ink/35">{person.role}</span>
        {person.suspended_at && (
          <span className="label text-hot">suspended</span>
        )}
      </button>

      {/*
        The email is shown because it is often the only thing a teacher knows
        about a student, and it is why search_people is gated on the sponsor
        capability rather than the moderator one.
      */}
      {person.email && (
        <p className="mt-1.5 text-sm text-ink/45">{person.email}</p>
      )}

      {open && (
        <div className="mt-6 space-y-7 border-t border-ink/10 pt-6">
          <form action={saveAction} className="space-y-7">
            <input type="hidden" name="target_id" value={person.id} />

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`title-${person.id}`}
                  className="label block text-ink/60"
                >
                  Title
                </label>
                <input
                  id={`title-${person.id}`}
                  name="title"
                  type="text"
                  defaultValue={person.title ?? ""}
                  maxLength={60}
                  placeholder="Vice President"
                  className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3"
                />
                <p className="mt-2 text-sm leading-relaxed text-ink/55">
                  Shown next to their name. Set it to &ldquo;Former Vice
                  President&rdquo; at the end of a term rather than removing the
                  account.
                </p>
              </div>

              <div>
                <label
                  htmlFor={`role-${person.id}`}
                  className="label block text-ink/60"
                >
                  Role
                </label>
                <select
                  id={`role-${person.id}`}
                  name="role"
                  defaultValue={person.role}
                  className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm leading-relaxed text-ink/55">
                  Sets the tag on their profile. It does not grant anything on
                  its own; the checkboxes below do that.
                </p>
              </div>
            </div>

            <fieldset className="space-y-5">
              <legend className="label text-ink/60">What they can do</legend>

              <Check
                id={`post-${person.id}`}
                name="can_post"
                defaultChecked={person.can_post}
                label="Can post videos"
                help="Publish videos of their own and edit them afterwards."
              />

              <div>
                <Check
                  id={`mod-${person.id}`}
                  name="can_moderate"
                  checked={moderate}
                  onChange={setModerate}
                  label="Can edit and delete other people's videos"
                  help="Remove or restore anything on the site, and handle reported comments."
                />
                {/*
                  Section 2 asks for this at the moment of granting, not in a
                  help page. The sponsor doing this is a teacher, and this is
                  the only screen where the decision is visible.
                */}
                {moderate && !person.can_moderate && (
                  <p className="mt-3 ml-7 rounded-lg border border-ember/50 bg-ember/10 px-4 py-3 text-sm leading-relaxed">
                    Once this person moderates anything, their account can be
                    suspended but not deleted. The record of what they did stays
                    attached to their name.
                  </p>
                )}
              </div>

              <Check
                id={`mng-${person.id}`}
                name="can_manage_users"
                defaultChecked={person.can_manage_users}
                label="Can manage people and permissions"
                help="Open this page, change anyone's role and capabilities, and lift suspensions."
              />
            </fieldset>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="label rounded-full bg-ink px-6 py-3.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving" : "Save"}
              </button>
              {saved && <span className="label text-ink/50">Saved</span>}
            </div>
          </form>

          <div className="border-t border-ink/10 pt-6">
            {person.suspended_at ? (
              <div>
                <p className="text-sm leading-relaxed text-ink/70">
                  Suspended{" "}
                  {new Date(person.suspended_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {person.suspension_reason
                    ? `: ${person.suspension_reason}`
                    : "."}
                </p>
                <form action={unsuspendAction} className="mt-4">
                  <input type="hidden" name="target_id" value={person.id} />
                  <button
                    type="submit"
                    disabled={unsuspending}
                    className="label rounded-full border border-ink/25 px-5 py-3 transition-colors hover:border-ink disabled:opacity-50"
                  >
                    {unsuspending ? "Lifting" : "Lift the suspension"}
                  </button>
                </form>
              </div>
            ) : suspendOpen ? (
              <form action={suspendAction} className="space-y-3">
                <input type="hidden" name="target_id" value={person.id} />
                <label
                  htmlFor={`reason-${person.id}`}
                  className="label block text-ink/60"
                >
                  Why are they being suspended?
                </label>
                <input
                  id={`reason-${person.id}`}
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  className="w-full rounded-lg border border-ink/25 bg-paper px-4 py-3"
                />
                <p className="text-sm leading-relaxed text-ink/55">
                  They can still sign in and watch. They cannot publish, be
                  tagged, or edit their profile. Their existing videos stay up.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={suspending || reason.trim().length === 0}
                    className="label rounded-full bg-hot px-6 py-3.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {suspending ? "Suspending" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuspendOpen(false)}
                    className="label text-ink/55 transition-colors hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSuspendOpen(true)}
                className="label text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-hot"
              >
                Suspend this account
              </button>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-hot/40 bg-hot/5 px-4 py-3 text-sm leading-relaxed"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** A checkbox with the plain-language label and the line of help §7 asks for. */
function Check({
  id,
  name,
  label,
  help,
  defaultChecked,
  checked,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  help: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const controlled = checked !== undefined;

  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          {...(controlled
            ? { checked, onChange: (e) => onChange?.(e.target.checked) }
            : { defaultChecked })}
          className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
        />
        <span className="font-medium">{label}</span>
      </label>
      <p className="mt-1.5 ml-7 text-sm leading-relaxed text-ink/55">{help}</p>
    </div>
  );
}

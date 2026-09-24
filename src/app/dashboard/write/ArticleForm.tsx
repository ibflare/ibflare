"use client";

import { useActionState } from "react";
import { createArticle, type ArticleState } from "./actions";
import { DIFFICULTY_LEVELS, TOPICS, TOPIC_LABELS } from "@/lib/taxonomy";

const EMPTY: ArticleState = {
  errors: {},
  values: { title: "", description: "", body: "", difficulty: "", topic: "" },
};

/**
 * Writing an article.
 *
 * Every field is uncontrolled with a defaultValue taken from the action's
 * echoed values, and that is load-bearing rather than incidental: React resets
 * an uncontrolled form after any action submits, success or failure, so a
 * refusal would otherwise throw away a thousand words. The action returns
 * `values` on every error path for exactly this reason. Same lesson as the
 * comment box, at a much higher cost if it is got wrong.
 */
export function ArticleForm() {
  const [state, formAction, pending] = useActionState(createArticle, EMPTY);
  const v = state.values;

  return (
    <form action={formAction} className="mt-10 space-y-8">
      {state.errors.form && (
        <p
          role="alert"
          className="rounded-lg border border-hot/40 bg-hot/5 px-5 py-4 text-sm leading-relaxed"
        >
          {state.errors.form}
        </p>
      )}

      <Field
        name="title"
        label="Title"
        defaultValue={v.title}
        error={state.errors.title}
        maxLength={200}
        required
      />

      <Field
        name="description"
        label="Standfirst (optional)"
        hint="One or two sentences. This is what shows on the library card."
        defaultValue={v.description}
        error={state.errors.description}
        maxLength={500}
      />

      <div>
        <label htmlFor="body" className="label block text-ink/60">
          Article
        </label>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          Plain text. Leave a blank line between paragraphs.
        </p>
        <textarea
          id="body"
          name="body"
          rows={18}
          defaultValue={v.body}
          required
          minLength={200}
          maxLength={40000}
          aria-describedby={state.errors.body ? "body-error" : undefined}
          aria-invalid={state.errors.body ? true : undefined}
          className="mt-3 w-full resize-y rounded-lg border border-ink/25 bg-paper px-4 py-3 leading-relaxed text-ink"
        />
        {state.errors.body && (
          <p id="body-error" role="alert" className="mt-2 text-sm text-hot">
            {state.errors.body}
          </p>
        )}
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor="difficulty" className="label block text-ink/60">
            Level
          </label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={v.difficulty}
            required
            className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
          >
            <option value="">Choose one</option>
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level.level} value={level.level}>
                {level.level}. {level.name} &middot; {level.audience}
              </option>
            ))}
          </select>
          {state.errors.difficulty && (
            <p role="alert" className="mt-2 text-sm text-hot">
              {state.errors.difficulty}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="topic" className="label block text-ink/60">
            Topic
          </label>
          <select
            id="topic"
            name="topic"
            defaultValue={v.topic}
            required
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
            <p role="alert" className="mt-2 text-sm text-hot">
              {state.errors.topic}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Publishing" : "Publish"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div>
      <label htmlFor={name} className="label block text-ink/60">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-2 text-sm leading-relaxed text-ink/55">
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        type="text"
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-hot">
          {error}
        </p>
      )}
    </div>
  );
}

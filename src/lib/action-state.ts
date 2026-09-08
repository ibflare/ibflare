/**
 * The shared shape a dashboard server action returns, and its initial value.
 *
 * THIS FILE EXISTS BECAUSE THE CONSTANT CANNOT LIVE IN AN ACTIONS FILE.
 *
 * `EMPTY_ACTION` was exported from `src/app/dashboard/actions.ts`, which
 * carries `"use server"`, and that is invalid: such a file may only export
 * async functions. Next validates every export when the module is loaded and
 * throws
 *
 *     A "use server" file can only export async functions, found object.
 *
 * from `next-flight-loader/action-validate`. It is a *runtime* check, not a
 * build one, which is why the build passed and the admin pages instead
 * returned a 500 the first time anybody submitted a form on them. Every
 * `useActionState` in the dashboard was reading its initial state from that
 * export, so all of them were broken and none of it showed up in `tsc`,
 * `eslint`, or `next build`.
 *
 * A `type` export is fine in an actions file, since types are erased before
 * the validator sees anything. A `const` is not. When in doubt: actions files
 * export functions, and nothing else.
 */
export type ActionState = { error: string | null; ok: boolean };

export const EMPTY_ACTION: ActionState = { error: null, ok: false };

/**
 * What the comment actions return.
 *
 * `body` and `token` exist because React resets an uncontrolled form after an
 * action submits, whether the action succeeded or not. A refused comment
 * therefore lost the text the person had written, which is the worst possible
 * moment to lose it: they now have to retype the whole thing to change one
 * word.
 *
 * The action echoes the submitted body back on failure and an empty string on
 * success, and `token` changes every time so the textarea can be keyed on it
 * and remount with the right `defaultValue`. Keying is what makes it work: a
 * changed `defaultValue` does nothing to an input that is already mounted.
 */
export type CommentState = {
  error: string | null;
  ok: boolean;
  body: string;
  token: string;
};

export const EMPTY_COMMENT: CommentState = {
  error: null,
  ok: false,
  body: "",
  token: "initial",
};

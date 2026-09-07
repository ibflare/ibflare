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

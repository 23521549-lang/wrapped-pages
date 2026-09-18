/** Bat bien 5: loi tu postgres.js rethrow chi giu code va message, khong keo theo chuoi ket noi. */
export function rethrowSafely(e: unknown): never {
  const code = (e as { code?: unknown } | null)?.code;
  const message = (e as { message?: unknown } | null)?.message;
  const err = new Error(typeof message === "string" ? message : "loi ket noi database e2e");
  if (typeof code === "string") Object.assign(err, { code });
  throw err;
}

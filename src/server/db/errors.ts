/**
 * Loi vi pham rang buoc unique cua Postgres (SQLSTATE 23505).
 * Drizzle boc loi cua driver trong DrizzleQueryError, ma SQLSTATE nam o .cause.code.
 */
export function isUniqueViolation(e: unknown): boolean {
  const code =
    (e as { cause?: { code?: unknown } } | null)?.cause?.code ??
    (e as { code?: unknown } | null)?.code;
  return code === "23505";
}

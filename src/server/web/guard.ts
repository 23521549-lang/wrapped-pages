import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { loadMe, type Me } from "@/server/identity/me";
import { currentAccount } from "./cookies";

export type { Me };

/**
 * Nguoi dang dang nhap khi web da du hai cho ngoi; con lai la null. Goi duoc tu trang lan server action;
 * cache() gop moi lan goi trong mot request thanh mot lan doc database.
 */
export const readMe = cache(async (): Promise<Me | null> => {
  const session = await currentAccount();
  return session ? loadMe(db, session.accountId) : null;
});

/** Cho moi man ben trong: thieu thi ve "/", de bo dinh tuyen goc quyet di dau. */
export async function requireMe(): Promise<Me> {
  const me = await readMe();
  if (!me) redirect("/");
  return me;
}

import "server-only";
import { eq } from "drizzle-orm";
import { db, getServerKey } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { readSecretHistory, readRevealedSecrets } from "@/server/identity/rename";

/** Du lieu man Cai dat. Chi goi sau khi trang da kiem dang nhap va du hai cho ngoi. */
export async function readSettingsView(accountId: string) {
  const serverKey = getServerKey();
  const [[self], written, received] = await Promise.all([
    db.select({ nickname: accounts.nickname }).from(accounts).where(eq(accounts.id, accountId)),
    readSecretHistory(db, { actorAccountId: accountId, serverKey }),
    readRevealedSecrets(db, { accountId, serverKey }),
  ]);
  if (!self) throw new Error("khong tim thay tai khoan");
  return { nickname: self.nickname, written, received };
}

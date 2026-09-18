import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { pickWriteTarget } from "@/server/library/write-target";
import { requireMe } from "@/server/web/guard";

/** Nut "Trang moi": mo ban nhap gan nhat, khong co thi cuon gan nhat, khong co cuon nao thi man tao sach. */
export default async function TrangMoi() {
  await connection();
  const me = await requireMe();
  const bookId = await pickWriteTarget(db, me.accountId);
  redirect(bookId ? `/sach/${bookId}/viet` : "/sach/moi");
}

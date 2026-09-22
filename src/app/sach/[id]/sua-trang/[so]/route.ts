import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { roundOfPosition } from "@/server/library/edit-round";
import { requireMe } from "@/server/web/guard";
import { roundEditPath, SO_TRANG } from "@/lib/round";

/**
 * Duong dan cu cua man sua mot to (da bo): chuyen han (308) sang man sua luot chua to do, mo ngay to do, de lien ket cu
 * khong chet. Dich doi sau moi lan sua luot (so to cua luot doi), nen kem Cache-Control: no-store: trinh duyet nho lau
 * mot 308 khong kem no. Sach nguoi kia, sach la, to la deu 404 nhu moi cho khac.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; so: string }> }): Promise<Response> {
  await connection();
  const [me, { id, so }] = await Promise.all([requireMe(), params]);
  if (!SO_TRANG.test(so)) notFound();
  const dich = await roundOfPosition(db, me.accountId, id, Number(so));
  if (!dich) notFound();
  return new Response(null, {
    status: 308,
    headers: { Location: new URL(roundEditPath(id, dich.ordinal, dich.sheet), request.url).toString(), "Cache-Control": "no-store" },
  });
}

import { connection } from "next/server";
import { db } from "@/server/db";
import { getMediaStore } from "@/server/media/get-store";
import { serveMedia } from "@/server/media/serve";
import { readMe } from "@/server/web/guard";

/**
 * Doc mot tep media. Moi request, ke ca tung khoang Range cua ghi am va ca lan hoi lai bang If-None-Match, deu qua
 * serveMedia va canViewMedia, nen sach chuyen rieng tu hay to con khoa thi lan doc sau bi tu choi ngay. Route chi doc
 * phien, kho tep va hai header Range, If-None-Match.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  await connection();
  const [{ id }, me] = await Promise.all([params, readMe()]);
  const { headers } = request;
  return serveMedia(db, getMediaStore(), me?.accountId ?? null, id, headers.get("range"), headers.get("if-none-match"), new Date());
}

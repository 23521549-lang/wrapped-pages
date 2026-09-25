import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readBook } from "@/server/library/pages";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { ReplyEditor } from "@/components/editor/ReplyEditor";

export default async function VietTraLoi({ params }: { params: Promise<{ id: string; sealId: string }> }) {
  await connection();
  const [me, { id, sealId }] = await Promise.all([requireMe(), params]);
  const view = await readBook(db, me.accountId, id);
  const seal = view?.seals.find((s) => s.id === sealId);
  // Sach khong doc duoc, ma rac, khong phai trao doi, cua chinh minh, hay da mo: tat ca 404 nhu nhau.
  if (!view || !seal || seal.kind !== "trao-doi" || seal.mine || !seal.locked || seal.question === null) notFound();
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage sticky={false} />
      <ReplyEditor
        sealId={seal.id}
        veHref={`/sach/${view.book.id}?trang=${seal.firstPosition}`}
        bookTitle={view.book.title}
        ownerName={me.partnerNickname}
        question={seal.question}
      />
    </>
  );
}

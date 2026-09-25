import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readDraft } from "@/server/library/drafts";
import { getMediaStore } from "@/server/media/get-store";
import { sachCuaToi } from "@/server/web/cong";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { Editor } from "@/components/editor/Editor";
import { TRANG_TRONG } from "@/lib/doc/types";

export default async function VietSach({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [me, { id }] = await Promise.all([requireMe(), params]);
  // readDraft tu kiem chu sach, nen doc song song voi cuon ma khong doc duoc nhap cua ai khac.
  const [book, draft] = await Promise.all([
    sachCuaToi(me.accountId, id),
    readDraft(db, me.accountId, id),
  ]);
  if (!book) notFound();
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage sticky={false} />
      <Editor
        bookId={book.id}
        bookTitle={book.title}
        partnerNickname={book.mode === "chia-se" ? me.partnerNickname : null}
        initialDoc={draft?.content ?? TRANG_TRONG}
        initialSavedAt={draft ? draft.updatedAt.toISOString() : null}
        author={me.nickname}
        mediaEnabled={getMediaStore() !== null}
        oLuot={draft?.trim ?? { cover: null, coverMediaId: null, youtubeId: null, dropTrack: false }}
      />
    </>
  );
}

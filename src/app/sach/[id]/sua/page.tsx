import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listRoundsForEdit } from "@/server/library/edit-round";
import { getMediaStore } from "@/server/media/get-store";
import { sachCuaToi } from "@/server/web/cong";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { BookForm } from "@/components/book/BookForm";
import { RoundList } from "@/components/book/RoundList";

export default async function SuaSach({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [me, { id }] = await Promise.all([requireMe(), params]);
  const now = new Date();
  // listRoundsForEdit tu kiem chu sach, nen doc song song voi cuon ma khong lo luot cua sach nguoi khac.
  const [book, luot] = await Promise.all([sachCuaToi(me.accountId, id), listRoundsForEdit(db, me.accountId, id, now)]);
  if (!book) notFound();
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Sửa sách</h1>
            <p className="head__sub">Đổi tên, ai đọc được, hay sửa nội dung từng lượt.</p>
          </div>
        </div>
        <BookForm
          book={{ id: book.id, title: book.title, mode: book.mode, cover: book.cover, youtubeId: book.youtubeId, coverMediaId: book.coverMediaId }}
          nickname={me.nickname}
          partnerNickname={me.partnerNickname}
          mediaEnabled={getMediaStore() !== null}
        />
        <RoundList bookId={book.id} rounds={luot ?? []} now={now} />
      </main>
    </>
  );
}

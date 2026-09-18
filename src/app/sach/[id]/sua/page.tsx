import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { findOwnBook } from "@/server/library/books";
import { getMediaStore } from "@/server/media/get-store";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { BookForm } from "@/components/book/BookForm";

export default async function SuaSach({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [me, { id }] = await Promise.all([requireMe(), params]);
  const book = await findOwnBook(db, me.accountId, id);
  if (!book) notFound();
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Sửa sách</h1>
            <p className="head__sub">Đổi tên, ai đọc được, bìa hoặc nhạc nền.</p>
          </div>
        </div>
        <BookForm
          book={{ id: book.id, title: book.title, mode: book.mode, cover: book.cover, youtubeId: book.youtubeId, coverMediaId: book.coverMediaId }}
          nickname={me.nickname}
          partnerNickname={me.partnerNickname}
          mediaEnabled={getMediaStore() !== null}
        />
      </main>
    </>
  );
}

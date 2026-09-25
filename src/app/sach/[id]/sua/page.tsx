import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listRoundsForEdit } from "@/server/library/edit-round";
import { coverSlots, trackSlots } from "@/server/library/timeline";
import { khoBia } from "@/server/media/cover";
import { getMediaStore } from "@/server/media/get-store";
import { sachCuaToi } from "@/server/web/cong";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { BookForm } from "@/components/book/BookForm";
import { CoverTimeline } from "@/components/book/CoverTimeline";
import { RoundList } from "@/components/book/RoundList";
import { TrackTimeline } from "@/components/book/TrackTimeline";
import { dateLabel } from "@/lib/when";

export default async function SuaSach({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [me, { id }] = await Promise.all([requireMe(), params]);
  const now = new Date();
  // Dot mot: ba phep doc tu kiem chu sach, chay song song.
  const [book, luot, kho] = await Promise.all([
    sachCuaToi(me.accountId, id),
    listRoundsForEdit(db, me.accountId, id, now),
    khoBia(db, me.accountId, id),
  ]);
  if (!book) notFound();
  // Dot hai: hai dong thoi gian chi doc theo ma cuon, khong tu kiem quyen (chang sau con dung chung cho ca cuon chia se
  // cua nguoi kia), nen chi goi sau khi da biet day la cuon cua minh.
  const [bia, nhac] = await Promise.all([coverSlots(db, book.id), trackSlots(db, book.id)]);
  // Nhan dung san o may chu: trinh duyet khong dinh dang ngay, nen hai lan ve khong lech nhau.
  const photos = kho.map((p) => ({ id: p.id, nhan: `Ảnh của bạn, tải ${dateLabel(p.createdAt, now)}` }));
  const coKho = getMediaStore() !== null;
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Sửa sách</h1>
            <p className="head__sub">Đổi tên, ai đọc được, bìa và nhạc từng lượt, hay sửa nội dung từng lượt.</p>
          </div>
        </div>
        <BookForm
          book={{ id: book.id, title: book.title, mode: book.mode, cover: book.cover, youtubeId: book.youtubeId, coverMediaId: book.coverMediaId }}
          nickname={me.nickname}
          partnerNickname={me.partnerNickname}
          mediaEnabled={coKho}
          photos={photos}
        />
        <CoverTimeline bookId={book.id} slots={bia} photos={photos} mediaEnabled={coKho} now={now} />
        <TrackTimeline bookId={book.id} slots={nhac} now={now} />
        <RoundList bookId={book.id} rounds={luot ?? []} now={now} />
      </main>
    </>
  );
}

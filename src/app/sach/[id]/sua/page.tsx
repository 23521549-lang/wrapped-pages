import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { coverSlots, trackSlots } from "@/server/library/timeline";
import { khoBia } from "@/server/media/cover";
import { getMediaStore } from "@/server/media/get-store";
import { tenCacBai } from "@/server/media/ten-youtube";
import { deNghiCuaSach } from "@/server/viet-cung/de-nghi";
import { sachVietDuoc } from "@/server/web/cong";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { BookForm } from "@/components/book/BookForm";
import { DongBia } from "@/components/book/DongBia";
import { DongNhac } from "@/components/book/DongNhac";
import { XoaCuon } from "@/components/viet-cung/XoaCuon";
import { dateLabel } from "@/lib/when";

/**
 * Man Sua sach (chu du an duyet 28/09): cung thu tu voi trang Sach moi, Ten sach, Bia, Nhac nen, Ai doc duoc, kem o
 * Xem truoc. Bia va Nhac nen la hai dong thoi gian theo luot, thu gon mac dinh, tu luu tung o; nut Luu cua form chi luu
 * ten va che do. Noi dung trang thi sua ngay tren man doc (nut "Sửa trang"), nen man nay khong con muc Noi dung.
 */
export default async function SuaSach({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [me, { id }] = await Promise.all([requireMe(), params]);
  const now = new Date();
  // Dot mot: hai phep doc tu kiem nguoi viet, chay song song.
  const [book, kho, deNghi] = await Promise.all([
    sachVietDuoc(me.accountId, id), khoBia(db, me.accountId, id), deNghiCuaSach(db, me.accountId, id),
  ]);
  if (!book) notFound();
  // Dot hai: hai dong thoi gian chi doc theo ma cuon, khong tu kiem quyen, nen chi goi sau khi da biet day la cuon cua
  // minh. Ten bai lay tu YouTube o may chu (co bo nho dem); lay khong duoc thi dong nhac ghi cau thay.
  const [bia, nhac] = await Promise.all([coverSlots(db, book.id), trackSlots(db, book.id)]);
  const ten = await tenCacBai(nhac.flatMap((s) => (s.o?.youtubeId ? [s.o.youtubeId] : [])));
  // Nhan dung san o may chu: trinh duyet khong dinh dang ngay, nen hai lan ve khong lech nhau.
  const photos = kho.map((p) => ({ id: p.id, nhan: `Ảnh của ${p.cuaToi ? "bạn" : me.partnerNickname}, tải ${dateLabel(p.createdAt, now)}` }));
  const coKho = getMediaStore() !== null;
  // Sach viet cung (5c muc F3): o ten la "Chủ đề", khong doi che do, cuoi trang co muc Xoa cuon (can ca hai dong y).
  const vietCung = book.vietCungTu !== null;
  const deNghiXoa = deNghi?.loai === "xoa-sach" ? (deNghi.cuaToi ? "cua-toi" : "cua-kia") : "khong";
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Sửa sách</h1>
            <p className="head__sub">{vietCung ? "Đổi chủ đề, bìa và nhạc từng lượt." : "Đổi tên, ai đọc được, bìa và nhạc từng lượt."}</p>
          </div>
        </div>
        <BookForm
          book={{ id: book.id, title: book.title, mode: book.mode, cover: book.cover, youtubeId: book.youtubeId, coverMediaId: book.coverMediaId }}
          nickname={me.nickname}
          partnerNickname={me.partnerNickname}
          mediaEnabled={coKho}
          photos={photos}
          giua={
            <>
              <DongBia bookId={book.id} slots={bia} photos={photos} mediaEnabled={coKho} now={now} />
              <DongNhac bookId={book.id} slots={nhac} ten={ten} now={now} />
            </>
          }
          vietCung={vietCung}
          deNghi={deNghi?.loai === "xoa-sach" ? null : deNghi}
        />
        {vietCung && <XoaCuon bookId={book.id} partnerNickname={me.partnerNickname} deNghi={deNghiXoa} headingId="xoa-cuon" />}
      </main>
    </>
  );
}

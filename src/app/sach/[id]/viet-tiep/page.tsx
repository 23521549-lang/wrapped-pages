import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readDraft } from "@/server/library/drafts";
import { khoBia } from "@/server/media/cover";
import { getMediaStore } from "@/server/media/get-store";
import { sachCuaToi } from "@/server/web/cong";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { TrimForm } from "@/components/book/TrimForm";
import { dateLabel } from "@/lib/when";

/*
 * Trang Viet tiep: chon bia va nhac cho LUOT SAP DANG roi mo man viet. Khong co o ten sach va khong co muc Ai doc duoc,
 * vi hai thu do la thuoc tinh cua ca cuon chu khong cua mot luot; doi chung van o trang Sua sach.
 * Ba lan doc chay song song: khoBia va readDraft deu tu kiem chu sach, nen khong cho doc cuon xong moi bat dau.
 */
export default async function VietTiep({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [me, { id }] = await Promise.all([requireMe(), params]);
  const now = new Date();
  const [book, draft, kho] = await Promise.all([
    sachCuaToi(me.accountId, id),
    readDraft(db, me.accountId, id),
    khoBia(db, me.accountId, id),
  ]);
  if (!book) notFound();
  // Nhan dung san o may chu: trinh duyet khong dinh dang ngay, nen lan ve o may chu va lan ve lai o trinh duyet
  // khong bao gio lech nhau.
  const photos = kho.map((p) => ({ id: p.id, nhan: `Ảnh của bạn, tải ${dateLabel(p.createdAt, now)}` }));
  const trim = draft?.trim ?? { cover: null, coverMediaId: null, youtubeId: null, dropTrack: false };
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Viết tiếp</h1>
            <p className="head__sub">Chọn bìa và nhạc cho lượt sắp đăng của {book.title}.</p>
          </div>
        </div>
        <TrimForm
          bookId={book.id}
          title={book.title}
          nickname={me.nickname}
          bia={{ cover: book.cover, coverMediaId: book.coverMediaId }}
          isPrivate={book.mode === "rieng-tu"}
          photos={photos}
          coNhac={book.youtubeId !== null}
          trim={trim}
          mediaEnabled={getMediaStore() !== null}
        />
      </main>
    </>
  );
}

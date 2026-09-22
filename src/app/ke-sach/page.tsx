import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listActivity } from "@/server/feed/list";
import { listShelf, type ShelfBook as Sach } from "@/server/library/shelf";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { OpenBook } from "@/components/book/OpenBook";
import { GlyphKhoa, GlyphRieng, ShelfBook } from "@/components/book/ShelfBook";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import { timeAgo } from "@/lib/when";

/** Mot ngan ke: tieu de, so cuon, hang sach. Ngan trong van giu mep ke va mot dong chu. */
function Ngan({ ten, books, trong, when }: { ten: string; books: Sach[]; trong: string; when: (b: Sach) => string }) {
  return (
    <section className="ngan" aria-label={ten}>
      <div className="ngan__dau">
        <h2 className="d">{ten}</h2>
        <span className="ngan__dem">{books.length} cuốn</span>
      </div>
      {books.length === 0 ? (
        <div className="ngan__trong">
          <p>{trong}</p>
          <span className="ke-mep" aria-hidden="true" />
        </div>
      ) : (
        <ul className="hang">
          {books.map((b) => (
            <ShelfBook
              key={b.id}
              title={b.title}
              href={`/sach/${b.id}`}
              cover={b.cover}
              coverMediaId={b.coverMediaId}
              pageCount={b.pageCount}
              when={when(b)}
              newCount={b.newCount}
              lockedCount={b.lockedCount}
              isPrivate={b.mode === "rieng-tu"}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function KeSach() {
  await connection();
  const me = await requireMe();
  // Mot now cho ca ke va dong Hoat dong: hen gio vua toi gio thi the sach va dong "da toi gio mo" noi cung mot dieu.
  const now = new Date();
  const [shelf, feed] = await Promise.all([listShelf(db, me.accountId, now), listActivity(db, me.accountId, now)]);
  const when = (b: Sach) => timeAgo(b.lastPublishedAt ?? b.createdAt, now);
  // listShelf sap theo to dang gan nhat, nen cuon dau tien co to chinh la cuon co trang gan nhat.
  const recent = shelf.find((b) => b.pageCount > 0);
  const fresh = shelf.reduce((n, b) => n + b.newCount, 0);
  // Chia hai ngan ngay tai day, giu nguyen thu tu listShelf tra ve.
  const cuaBan = shelf.filter((b) => b.mine);
  const cuaKia = shelf.filter((b) => !b.mine);
  const hoatDong = <ActivityPanel items={feed} now={now} partnerName={me.partnerNickname} />;

  return (
    <>
      <AppNav me={me} current="ke-sach" />
      <main className="shell man">
        <div className="ke-dau">
          <div>
            <h1 className="d">Kệ sách</h1>
            <p className="ke-dau__phu">
              {shelf.length > 0 ? `${shelf.length} cuốn${fresh > 0 ? `, ${fresh} trang mới` : ""}` : "Chưa có cuốn nào"}
            </p>
          </div>
          {shelf.length > 0 && <Link className="btn btn--quiet" href="/sach/moi">Sách mới</Link>}
        </div>

        {shelf.length === 0 ? (
          <div className="dau-ke">
            <div className="ke-trong">
              <h2 className="d">Kệ còn trống.</h2>
              <p>Cuốn đầu tiên bạn tạo sẽ đứng ở đây. Cuốn nào chia sẻ thì {me.partnerNickname} cũng đọc được.</p>
              <Link className="btn" href="/sach/moi">Tạo sách</Link>
              <span className="ke-mep ke-trong__mep" aria-hidden="true" />
            </div>
            {hoatDong}
          </div>
        ) : (
          <>
            <div className="dau-ke">
              {recent && (
                <OpenBook
                  who={recent.mine ? "Bạn" : recent.ownerNickname}
                  title={recent.title}
                  cover={recent.cover}
                  coverMediaId={recent.coverMediaId}
                  pageCount={recent.pageCount}
                  position={recent.excerptPosition}
                  readHref={`/sach/${recent.id}?trang=${recent.excerptPosition}`}
                  when={when(recent)}
                  excerpt={recent.excerpt}
                  locked={recent.excerptLocked}
                  isPrivate={recent.mode === "rieng-tu"}
                  action={recent.mine
                    ? { label: "Viết tiếp", href: `/sach/${recent.id}/viet` }
                    : { label: "Đọc tiếp", href: `/sach/${recent.id}` }}
                />
              )}
              {hoatDong}
            </div>

            <Ngan ten="Kệ của bạn" books={cuaBan} trong="Bạn chưa có cuốn nào." when={when} />
            <Ngan
              ten={`Kệ của ${me.partnerNickname}`}
              books={cuaKia}
              trong={`${me.partnerNickname} chưa chia sẻ cuốn nào.`}
              when={when}
            />

            <footer className="foot">
              <ul className="legend" aria-label="Chú giải">
                <li><span className="dh dh--moi"><span className="cham" aria-hidden="true" />Trang mới</span> chưa đọc</li>
                <li><span className="dh"><GlyphKhoa />Trang khóa</span> cần vượt thử thách</li>
                <li><span className="dh"><GlyphRieng />Riêng tư</span> chỉ mình bạn thấy</li>
              </ul>
            </footer>
          </>
        )}
      </main>
    </>
  );
}

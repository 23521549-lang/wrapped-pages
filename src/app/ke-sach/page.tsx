import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listActivity } from "@/server/feed/list";
import { listShelf, type ShelfBook } from "@/server/library/shelf";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { BookCard } from "@/components/book/BookCard";
import { CoverArt } from "@/components/book/CoverArt";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import { timeAgo } from "@/lib/when";

export default async function KeSach() {
  await connection();
  const me = await requireMe();
  // Mot now cho ca ke va dong Hoat dong: hen gio vua toi gio thi the sach va dong "da toi gio mo" noi cung mot dieu.
  const now = new Date();
  const [shelf, feed] = await Promise.all([listShelf(db, me.accountId, now), listActivity(db, me.accountId, now)]);
  const when = (b: ShelfBook) => timeAgo(b.lastPublishedAt ?? b.createdAt, now);
  // listShelf sap theo to dang gan nhat, nen cuon dau tien co to chinh la cuon co trang gan nhat.
  const recent = shelf.find((b) => b.pageCount > 0);
  const locked = shelf.reduce((n, b) => n + b.lockedCount, 0);
  const hoatDong = <ActivityPanel items={feed} now={now} myName={me.nickname} partnerName={me.partnerNickname} />;

  return (
    <>
      <AppNav me={me} current="ke-sach" />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Kệ sách</h1>
            <p className="head__sub">
              {shelf.length > 0 ? `${shelf.length} cuốn${locked > 0 ? ` · ${locked} trang đang khóa` : ""}` : "Chưa có cuốn nào"}
            </p>
          </div>
          {shelf.length > 0 && <Link className="btn" href="/sach/moi">Sách mới</Link>}
        </div>

        {shelf.length === 0 ? (
          <div className="dau-ke">
            <div className="trong">
              <div className="trong__hinh bia bia--nui-xa"><CoverArt cover="nui-xa" /></div>
              <h2 className="trong__t d">Kệ còn trống.</h2>
              <p>Mỗi cuốn là một chuỗi trang do một người viết. Cuốn nào chia sẻ thì người kia đọc được.</p>
              <Link className="btn" href="/sach/moi">Tạo sách</Link>
            </div>
            {hoatDong}
          </div>
        ) : (
          <>
            <div className="dau-ke">
              {recent && (
                <article className="recent" aria-label="Trang gần nhất">
                  <div className="recent__chu">
                    <p className="meta">{recent.ownerNickname} · {when(recent)}</p>
                    <h2 className="recent__t d">{recent.title}</h2>
                    {recent.excerpt && <p className="recent__x">{recent.excerpt}</p>}
                  </div>
                  <div className="recent__side">
                    <p className="recent__n">{recent.pageCount}</p>
                    <p className="label">Trang</p>
                    <div className="recent__acts">
                      {recent.mine && <Link className="btn btn--sm" href={`/sach/${recent.id}/viet`}>Viết tiếp</Link>}
                      <Link
                        className="btn btn--quiet btn--sm"
                        href={recent.mine ? `/sach/${recent.id}?trang=${recent.lastPosition}` : `/sach/${recent.id}`}
                      >
                        Đọc tiếp
                      </Link>
                    </div>
                  </div>
                </article>
              )}
              {hoatDong}
            </div>

            <section className="grid" aria-label="Sách trên kệ">
              {shelf.map((b) => (
                <BookCard
                  key={b.id}
                  href={`/sach/${b.id}`}
                  title={b.title}
                  cover={b.cover}
                  coverMediaId={b.coverMediaId}
                  owner={b.ownerNickname}
                  meta={`${b.ownerNickname} · ${when(b)}`}
                  excerpt={b.excerpt ?? "Chưa có trang nào."}
                  pageCount={b.pageCount}
                  newCount={b.newCount}
                  lockedCount={b.lockedCount}
                  isPrivate={b.mode === "rieng-tu"}
                />
              ))}
            </section>

            <footer className="foot">
              <ul className="legend" aria-label="Chú giải">
                <li><span className="new" aria-hidden="true" />Trang mới chưa đọc</li>
                <li><span className="chip">Trang khóa</span>Cần vượt thử thách</li>
                <li><span className="chip">Riêng tư</span>Chỉ mình bạn thấy</li>
              </ul>
              <p className="meta">Món Quà Của Em · 2026</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}

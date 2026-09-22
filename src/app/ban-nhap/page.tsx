import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listDrafts, listUnwrittenBooks } from "@/server/library/drafts";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { DraftRemove } from "@/components/book/DraftRemove";
import { savedLabel } from "@/lib/when";

const TIEU_DE = "ban-nhap-tieu-de";

export default async function BanNhap() {
  await connection();
  const me = await requireMe();
  const [items, chuaViet] = await Promise.all([listDrafts(db, me.accountId), listUnwrittenBooks(db, me.accountId)]);
  const now = new Date();
  const tong = items.length + chuaViet.length;

  return (
    <>
      <AppNav me={me} current="ban-nhap" />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 id={TIEU_DE} className="d" tabIndex={-1}>Bản nháp</h1>
            <p className="head__sub">
              {tong === 0
                ? "Chưa có bản nháp nào"
                : `${[items.length > 0 ? `${items.length} bản nháp` : "", chuaViet.length > 0 ? `${chuaViet.length} cuốn chưa viết` : ""].filter(Boolean).join(", ")} · chỉ mình bạn thấy`}
            </p>
          </div>
        </div>

        {tong === 0 ? (
          <div className="trong">
            <div className="trong__hinh bia bia--khom-truc"><CoverArt cover="khom-truc" /></div>
            <h2 className="trong__t d">Chưa có bản nháp.</h2>
            <p>Trang nào bạn viết dở mà chưa đăng sẽ nằm ở đây. {me.partnerNickname} không thấy bản nháp của bạn.</p>
            <Link className="btn" href="/ke-sach">Mở kệ sách</Link>
          </div>
        ) : (
          <ul className="nhap-ds" aria-label="Các bản nháp của bạn">
            {items.map((d) => (
              <li key={d.bookId} className="nhap">
                <div className={`nhap__bia bia bia--${d.cover}`}><CoverArt cover={d.cover} /><CoverImage mediaId={d.coverMediaId} /></div>
                <p className="nhap__t d">
                  <span className="nhap__ten">{d.title}</span>
                  {d.mode === "rieng-tu" && <span className="chip">Riêng tư</span>}
                </p>
                <p className="nhap__m">{savedLabel(d.updatedAt, now)} · {d.sheetCount} trang nháp</p>
                {d.excerpt && <p className="nhap__x">{d.excerpt}</p>}
                <DraftRemove bookId={d.bookId} hasPages={d.hasPages} headingId={TIEU_DE}>
                  <Link className="btn btn--sm" href={`/sach/${d.bookId}/viet`}>Viết tiếp</Link>
                </DraftRemove>
              </li>
            ))}
            {chuaViet.map((c) => (
              <li key={c.bookId} className="nhap">
                <div className={`nhap__bia bia bia--${c.cover}`}><CoverArt cover={c.cover} /><CoverImage mediaId={c.coverMediaId} /></div>
                <p className="nhap__t d">
                  <span className="nhap__ten">{c.title}</span>
                  {c.mode === "rieng-tu" && <span className="chip">Riêng tư</span>}
                </p>
                <p className="nhap__m">Chưa viết chữ nào</p>
                <DraftRemove bookId={c.bookId} hasPages={false} headingId={TIEU_DE}>
                  <Link className="btn btn--sm" href={`/sach/${c.bookId}/viet`}>Viết tiếp</Link>
                </DraftRemove>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

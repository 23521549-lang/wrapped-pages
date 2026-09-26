import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listActivity } from "@/server/feed/list";
import { listShelf, type ShelfBook as Sach } from "@/server/library/shelf";
import { coverSlots } from "@/server/library/timeline";
import { currentMoods } from "@/server/mood/moods";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { OpenBook } from "@/components/book/OpenBook";
import { Ngan, type SachTrenKe } from "@/components/book/Ngan";
import { GlyphKhoa, GlyphRieng } from "@/components/book/ShelfBook";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import { BauTroi } from "@/components/tam-trang/BauTroi";
import { TroiTam } from "@/components/tam-trang/troi-tam";
import { HoaDefs } from "@/components/tam-trang/HoaEp";
import { ThaTamTrang } from "@/components/tam-trang/ThaTamTrang";
import { chiaTamTrang, conLai, troiHien } from "@/lib/tam-trang/lich";
import { timeAgo } from "@/lib/when";

export default async function KeSach() {
  await connection();
  const me = await requireMe();
  // Mot now cho ca ke va dong Hoat dong: hen gio vua toi gio thi the sach va dong "da toi gio mo" noi cung mot dieu.
  const now = new Date();
  const [shelf, feed, moods] = await Promise.all([
    listShelf(db, me.accountId, now),
    listActivity(db, me.accountId, now),
    currentMoods(db, now),
  ]);
  // Dai troi: mac dinh troi cua nguoi kia, troi cua minh o o cua so (hoac la troi lon khi chi minh co); them cham mau
  // tren nut va hop chon o dong tieu de.
  const { minh, kia } = chiaTamTrang(moods, me.accountId);
  const when = (b: Sach) => timeAgo(b.lastPublishedAt ?? b.createdAt, now);
  // listShelf sap theo to dang gan nhat, nen cuon dau tien co to chinh la cuon co trang gan nhat.
  const recent = shelf.find((b) => b.pageCount > 0);
  // Dong thoi gian bia doc cho DUNG MOT cuon: chi khung sach lon moi tu doi bia, the tren ke luon giu bia moi nhat.
  const biaCuaKhung = recent === undefined ? [] : (await coverSlots(db, recent.id)).flatMap((s) => (s.o === null ? [] : [{ cover: s.o.cover, coverMediaId: s.o.coverMediaId }]));
  // Khong ai giu tam trang thi dai troi khong hien, tuc khong con nut tam dung nao tren trang: khung bia tu dat mot nut.
  const coDaiTroi = minh !== null || kia !== null;
  const fresh = shelf.reduce((n, b) => n + b.newCount, 0);
  // Chia hai ngan ngay tai day, giu nguyen thu tu listShelf tra ve.
  // Ngan la thanh phan TRINH DUYET, nen chi dua sang no dung nhung truong mot the sach ve ra. Ca dong ShelfBook mang
  // theo `excerpt`, ma doan trich cua mot luot con niem phong khong bao gio duoc xuong trinh duyet, ke ca duoi dang
  // khong ve ra. Thoi diem tuong doi cung tinh o day, vi ham khong di qua duoc ranh gioi may chu - trinh duyet.
  const theKe = (b: Sach): SachTrenKe => ({
    id: b.id, title: b.title, cover: b.cover, coverMediaId: b.coverMediaId,
    pageCount: b.pageCount, newCount: b.newCount, lockedCount: b.lockedCount,
    isPrivate: b.mode === "rieng-tu", when: when(b),
  });
  const cuaBan = shelf.filter((b) => b.mine).map(theKe);
  const cuaKia = shelf.filter((b) => !b.mine).map(theKe);
  const hoatDong = <ActivityPanel items={feed} now={now} partnerName={me.partnerNickname} />;

  return (
    <>
      <AppNav me={me} current="ke-sach" />
      <main className="man">
        <HoaDefs />
        {/* Troi tam cua lan tha (spec bo sung B5) di tu hop tha sang dai troi: mot ngu canh boc ca hai, khong ve the nao. */}
        <TroiTam>
          <BauTroi
            tenKia={me.partnerNickname}
            kia={kia ? troiHien(kia, now) : null}
            minh={minh ? troiHien(minh, now) : null}
          />
          <div className="shell">
            <ThaTamTrang
              dau={(
                <div>
                  <h1 className="d">Kệ sách</h1>
                  <p className="ke-dau__phu">
                    {shelf.length > 0 ? `${shelf.length} cuốn${fresh > 0 ? `, ${fresh} trang mới` : ""}` : "Chưa có cuốn nào"}
                  </p>
                </div>
              )}
              nutPhu={shelf.length > 0 ? <Link className="btn btn--quiet" href="/sach/moi">Sách mới</Link> : null}
              dangGiu={minh ? { weather: minh.weather, conLai: conLai(minh.endsAt, now) } : null}
              minh={minh ? troiHien(minh, now) : null}
              tenKia={me.partnerNickname}
            />

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
                      covers={biaCuaKhung}
                      tuDatNut={!coDaiTroi}
                      dauHref={`/dau-thoi-gian/${recent.id}`}
                      pageCount={recent.pageCount}
                      position={recent.excerptPosition}
                      readHref={`/sach/${recent.id}?trang=${recent.excerptPosition}`}
                      when={when(recent)}
                      excerpt={recent.excerpt}
                      locked={recent.excerptLocked}
                      isPrivate={recent.mode === "rieng-tu"}
                      action={recent.mine
                        ? { label: "Viết tiếp", href: `/sach/${recent.id}/viet-tiep` }
                        // "Đọc tiếp" la mo cuon sach de doc tiep: qua tam bia nhu moi loi vao tu ke (chu du an chot 26/09),
                        // roi man doc mo o to dau chua doc. Chi ca khung sach lon mo thang to cua doan trich.
                        : { label: "Đọc tiếp", href: `/sach/${recent.id}` }}
                    />
                  )}
                  {hoatDong}
                </div>

                <Ngan ten="Kệ của bạn" books={cuaBan} trong="Bạn chưa có cuốn nào." />
                <Ngan
                  ten={`Kệ của ${me.partnerNickname}`}
                  books={cuaKia}
                  trong={`${me.partnerNickname} chưa chia sẻ cuốn nào.`}
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
          </div>
        </TroiTam>
      </main>
    </>
  );
}

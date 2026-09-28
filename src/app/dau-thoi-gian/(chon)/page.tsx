import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listShelf } from "@/server/library/shelf";
import { demNhac } from "@/server/library/timeline";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";

/*
 * Trang chon cuon cua Dau thoi gian. Nam trong nhom tuyen (chon) de khung giu cho (loading.tsx) cua no chi boc CHINH
 * trang nay: boc ca doan con [id] thi trang cua mot cuon bat dau stream voi ma 200 truoc khi cong cua no kip tra 404.
 * Tu 28/09 trang Dau thoi gian chi con nhac, nen moi dong ghi so ban nhac cua cuon.
 * Liet ke DUNG nhung cuon nguoi xem thay duoc tren ke (listShelf: cuon cua minh ke ca
 * rieng tu, cong cuon chia se cua nguoi kia), khong rong hon. Moi dong mot cuon, bam vao thi toi luoi muoi hai thang
 * cua cuon do.
 */
export default async function DauThoiGian() {
  await connection();
  const me = await requireMe();
  const now = new Date();
  const ke = await listShelf(db, me.accountId, now);
  const dem = await demNhac(db, ke.map((b) => b.id));
  return (
    <>
      <AppNav me={me} current="dau-thoi-gian" />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Dấu thời gian</h1>
            <p className="head__sub">Chọn một cuốn để nghe lại nhạc của nó theo thời gian.</p>
          </div>
        </div>
        {ke.length === 0 ? (
          <div className="trong">
            <p className="trong__t d">Chưa có cuốn nào.</p>
            <p>Mỗi lượt đăng đặt được một bản nhạc. Tạo cuốn đầu tiên để bắt đầu.</p>
            <Link className="btn" href="/sach/moi">Tạo sách</Link>
          </div>
        ) : (
          <ul className="nhap-ds">
            {ke.map((b) => {
              const nhac = dem.get(b.id) ?? 0;
              return (
                <li key={b.id} className="nhap dtg-dong">
                  <span className={`nhap__bia bia bia--${b.cover}`} aria-hidden="true">
                    <CoverArt cover={b.cover} />
                    <CoverImage mediaId={b.coverMediaId} />
                  </span>
                  <p className="nhap__t d">
                    <Link className="nhap__ten" href={`/dau-thoi-gian/${b.id}`}>{b.title}</Link>
                  </p>
                  <p className="nhap__m">{`${b.mine ? "Bạn" : b.ownerNickname}, ${nhac} bản nhạc`}</p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

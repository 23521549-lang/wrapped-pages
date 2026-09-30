import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/server/db";
import { listShelf } from "@/server/library/shelf";
import { demNhac } from "@/server/library/timeline";
import { thangCoNhac } from "@/server/nhac/so-nhac";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { COVERS } from "@/lib/book";
import { phanThang, tenThang, thangCua, thangSau, type Thang } from "@/lib/tam-trang/lich";

/** "Tháng Chín", kem nam khi khac nam hien tai: "Tháng Mười Hai, 2025". */
function tenSo(t: Thang, nay: Thang): string {
  const ten = tenThang(t);
  return `${ten.charAt(0).toUpperCase()}${ten.slice(1)}${t.y === nay.y ? "" : `, ${t.y}`}`;
}

/*
 * Trang chon cuon cua Dau thoi gian. Nam trong nhom tuyen (chon) de khung giu cho (loading.tsx) cua no chi boc CHINH
 * trang nay: boc ca doan con [id] thi trang cua mot cuon bat dau stream voi ma 200 truoc khi cong cua no kip tra 404.
 * Tu 28/09 trang Dau thoi gian chi con nhac, nen moi dong ghi so ban nhac cua cuon.
 * Liet ke DUNG nhung cuon nguoi xem thay duoc tren ke (listShelf: cuon cua minh ke ca
 * rieng tu, cong cuon chia se cua nguoi kia), khong rong hon. Moi dong mot cuon, bam vao thi toi luoi muoi hai thang
 * cua cuon do. Tren danh sach la dai "Sổ nhạc theo tháng" (5b): moi thang da khep co bai la mot cuon so mong dan toi so
 * nhac thang do; thang dang chay la the "Đang ghi".
 */
export default async function DauThoiGian() {
  await connection();
  const me = await requireMe();
  const now = new Date();
  const ke = await listShelf(db, me.accountId, now);
  const [dem, cacSo] = await Promise.all([demNhac(db, ke.map((b) => b.id)), thangCoNhac(db, me.accountId, now)]);
  const nay = thangCua(now);
  const mo = thangSau(nay);
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
        <section className="so-thang" aria-labelledby="so-thang-t">
          <div className="so-thang__dau">
            <h2 id="so-thang-t" className="d">Sổ nhạc theo tháng</h2>
            <p className="so-thang__phu">Mỗi tháng khép lại thành một cuốn sổ</p>
          </div>
          <ul className="so-thang__ds">
            <li className="so so--dang">
              <div className="so__chu">
                <p className="so__ten">{tenSo(nay, nay)}</p>
                <p className="so__phu"><b>Đang ghi</b>{`, mở vào ngày 1.${mo.m}`}</p>
              </div>
            </li>
            {cacSo.flatMap((s) => {
              const t = phanThang(s.thang);
              if (t === null) return [];
              const ten = tenSo(t, nay);
              return [
                <li key={s.thang} className={`so bia--${COVERS[(t.y * 12 + t.m) % COVERS.length]}`}>
                  <div className="so__chu">
                    <p className="so__ten">{ten}</p>
                    <p className="so__phu">{`${s.soBai} bài, ${s.soDanhSach === 1 ? "một" : "hai"} danh sách`}</p>
                  </div>
                  <Link className="so__lien" href={`/dau-thoi-gian/thang/${s.thang}`} aria-label={`Sổ nhạc ${tenThang(t)}${t.y === nay.y ? "" : `, ${t.y}`}, ${s.soBai} bài`} />
                </li>,
              ];
            })}
          </ul>
        </section>
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

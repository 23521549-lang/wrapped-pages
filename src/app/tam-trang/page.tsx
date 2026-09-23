import { connection } from "next/server";
import { db } from "@/server/db";
import { moodCalendar } from "@/server/mood/moods";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { HoaDefs } from "@/components/tam-trang/HoaEp";
import { LichHoa } from "@/components/tam-trang/LichHoa";
import {
  docThang, gomLich, laThangNay, luoiThang, ngayTrongThang, soNgayCua, thangKhoa, thangSau, thangTruoc,
} from "@/lib/tam-trang/lich";

/**
 * Lich hoa: moi ngay mot bong hoa ep cua tam trang cuoi cung trong ngay, hai hang cho hai nguoi. Thang doc tu ?thang=YYYY-MM
 * (sai hay o tuong lai thi ve thang nay). Khong muc nao tren thanh dieu huong duoc danh dau: loi vao la dai troi va hop
 * Tha tam trang tren Ke sach.
 */
export default async function LichHoaPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, query] = await Promise.all([requireMe(), searchParams]);
  const now = new Date();
  const thang = docThang(query.thang, now);
  const rows = await moodCalendar(db, thang);
  const nay = laThangNay(thang, now);
  const homNay = nay ? ngayTrongThang(now) : null;

  return (
    <>
      <AppNav me={me} current={null} />
      <main className="shell man">
        <HoaDefs />
        <div className="head">
          <div>
            <h1 className="d">Lịch hoa</h1>
            <p className="head__sub head__sub--hep">Mỗi ngày một bông hoa ép, từ tâm trạng cuối cùng thả trong ngày.</p>
          </div>
        </div>
        <LichHoa
          key={thangKhoa(thang)}
          thang={thang}
          tuan={luoiThang(thang, homNay)}
          ngay={gomLich(rows, me.accountId)}
          homNay={homNay}
          chonDau={homNay ?? soNgayCua(thang)}
          now={now}
          tenKia={me.partnerNickname}
          tenMinh={me.nickname}
          truocHref={`/tam-trang?thang=${thangKhoa(thangTruoc(thang))}`}
          sauHref={nay ? null : `/tam-trang?thang=${thangKhoa(thangSau(thang))}`}
        />
      </main>
    </>
  );
}

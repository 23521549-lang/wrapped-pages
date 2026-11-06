import { connection } from "next/server";
import { db } from "@/server/db";
import { lichCacThang, moodCalendar } from "@/server/mood/moods";
import { thuCacThang } from "@/server/thu/thu";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { HoaDefs } from "@/components/tam-trang/HoaEp";
import { LichHoa } from "@/components/tam-trang/LichHoa";
import { TongKetThang, type ThangTongKetHien } from "@/components/tam-trang/TongKetThang";
import {
  docThang, gomLich, laThangNay, luoiThang, ngayTrongThang, phanThang, soNgayCua, tenThang, thangCua, thangKhoa, thangSau,
  thangTruoc,
} from "@/lib/tam-trang/lich";
import { thangCoTongKet, tongKetThang } from "@/lib/tam-trang/tong-ket";
import { momentLabel } from "@/lib/when";

const hoaDau = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/**
 * Lich hoa: moi ngay mot bong hoa ep cua tam trang cuoi cung trong ngay, hai hang cho hai nguoi. Thang doc tu ?thang=YYYY-MM
 * (sai hay o tuong lai thi ve thang nay). Khong muc nao tren thanh dieu huong duoc danh dau: loi vao la dai troi va hop
 * Tha tam trang tren Ke sach. Duoi lich la tong ket cac thang da khep va thu thang (5b): thu cua chinh nguoi xem khong bao
 * gio xuong trinh duyet (thuCacThang chi tra thu nguoi kia, va chi khi nguoi xem da gui thu thang do).
 */
export default async function LichHoaPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, query] = await Promise.all([requireMe(), searchParams]);
  const now = new Date();
  const thang = docThang(query.thang, now);
  const nay = laThangNay(thang, now);
  const thangNay = thangCua(now);
  const [rows, rowsNay, cacLich, cacThu] = await Promise.all([
    moodCalendar(db, thang, me.accountId, me.khoangLang),
    nay ? null : moodCalendar(db, thangNay, me.accountId, me.khoangLang),
    lichCacThang(db, now, me.accountId, me.khoangLang),
    thuCacThang(db, me.accountId, me.khoangLang),
  ]);
  const tkNay = tongKetThang(gomLich(rowsNay ?? rows, me.accountId), me.partnerNickname, me.khoangLang);
  const tongKet = thangCoTongKet([...cacLich.keys(), ...cacThu.map((t) => t.thang)], now).flatMap((khoa): ThangTongKetHien[] => {
    const t = phanThang(khoa);
    if (t === null) return [];
    const thu = cacThu.find((x) => x.thang === khoa);
    return [{
      khoa,
      ten: `${hoaDau(tenThang(t))}, ${t.y}`,
      tenThangChu: tenThang(t),
      tk: tongKetThang(gomLich(cacLich.get(khoa) ?? [], me.accountId), me.partnerNickname, me.khoangLang),
      thu: {
        tt: { minhGui: thu?.minhGui ?? false, kiaGui: thu?.kiaGui ?? false },
        kia: thu?.kia ? { noiDung: thu.kia.noiDung, gio: momentLabel(thu.kia.guiLuc, now) } : null,
        chuaMo: thu?.kia?.moLuc === null,
      },
    }];
  });
  const homNay = nay ? ngayTrongThang(now) : null;
  // Khoang Lang (Q2a): ten doi phuong khong xuat hien o bat cu cho nao, ke ca prop xuong component con
  // (payload RSC van nhung ten do neu truyen tho, du UI khong ve ra).
  const tenKia = me.khoangLang ? "người đọc" : me.partnerNickname;

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
          tenKia={tenKia}
          tenMinh={me.nickname}
          truocHref={`/tam-trang?thang=${thangKhoa(thangTruoc(thang))}`}
          sauHref={nay ? null : `/tam-trang?thang=${thangKhoa(thangSau(thang))}`}
          khoangLang={me.khoangLang}
        />
        <TongKetThang
          thang={tongKet}
          nay={{ ten: hoaDau(tenThang(thangNay)), mo: `1.${thangSau(thangNay).m}`, noiBat: tkNay.noiBat.minh ?? tkNay.noiBat.kia }}
          tenKia={tenKia}
          tenMinh={me.nickname}
          khoangLang={me.khoangLang}
        />
      </main>
    </>
  );
}

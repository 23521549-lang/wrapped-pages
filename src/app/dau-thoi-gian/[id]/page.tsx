import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { findReadableBook } from "@/server/library/books";
import { coverSlots, trackSlots } from "@/server/library/timeline";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { LichDau, type DauHien } from "@/components/dau-thoi-gian/LichDau";
import { docThangSach, gomTheoNgay, ngayMacDinh, thangMacDinh, type Dau } from "@/lib/dau-thoi-gian";
import { pageRange } from "@/lib/seal/reader";
import { laThangNay, luoiThang, ngayTrongThang, soNgayCua, thangCua, thangKhoa, thangSau, thangTruoc } from "@/lib/tam-trang/lich";
import { timeLabel } from "@/lib/when";

/**
 * Dau thoi gian cua MOT cuon: hai dong thoi gian bia va nhac tren mot lich thang cung khung voi Lich hoa. Hai phep doc
 * chay song song, khong mot phep doc nao theo tung thang. Trang khong doc va khong hien mot chu nao cua noi dung to,
 * nen niem phong khong lien quan; "Đọc từ trang N" dan toi man doc, noi moi luat niem phong van giu nguyen.
 */
export default async function DauThoiGianCuaSach({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, { id }, query] = await Promise.all([requireMe(), params, searchParams]);
  const book = await findReadableBook(db, me.accountId, id);
  if (!book) notFound();
  const now = new Date();
  const [bia, nhac] = await Promise.all([coverSlots(db, book.id), trackSlots(db, book.id)]);

  const dau: Dau[] = [
    ...bia.flatMap((s): Dau[] => (s.o === null ? [] : [{
      loai: "bia", key: `bia-${s.o.id}`, ordinal: s.ordinal, first: s.first, last: s.last, at: s.at,
      cover: s.o.cover, coverMediaId: s.o.coverMediaId,
    }])),
    ...nhac.flatMap((s): Dau[] => (s.o === null ? [] : [{
      loai: "nhac", key: `nhac-${s.o.id}`, ordinal: s.ordinal, first: s.first, last: s.last, at: s.at, youtubeId: s.o.youtubeId,
    }])),
  ];

  const thangNay = thangCua(now);
  const thang = docThangSach(query.thang, thangCua(book.createdAt), thangNay, thangMacDinh(dau, now));
  const nay = laThangNay(thang, now);
  const homNay = nay ? ngayTrongThang(now) : null;
  const theoNgay = gomTheoNgay(dau, thang);

  // Moi chu dung san o may chu, de lan ve dau cua trinh duyet khong lech voi HTML may chu gui xuong.
  const hien = Object.fromEntries(Object.entries(theoNgay).map(([so, ds]) => [so, ds.map((d): DauHien => {
    const chung = {
      key: d.key,
      luot: d.ordinal === null ? "mo-dau" : `luot-${d.ordinal}`,
      nhan: d.ordinal === null ? "Lúc tạo sách" : `Lượt ${d.ordinal}, ${pageRange(d.first ?? 0, d.last ?? 0)}`,
      gio: timeLabel(d.at),
      docHref: d.first === null ? `/sach/${book.id}` : `/sach/${book.id}?trang=${d.first}`,
      docNhan: d.first === null ? "Đọc từ đầu" : `Đọc từ trang ${d.first}`,
    };
    return d.loai === "bia"
      ? { ...chung, loai: "bia", cover: d.cover, coverMediaId: d.coverMediaId }
      : { ...chung, loai: "nhac", go: d.youtubeId === null };
  })]));

  const tao = thangCua(book.createdAt);
  const duong = (t: typeof thang) => `/dau-thoi-gian/${book.id}?thang=${thangKhoa(t)}`;
  const chu = book.ownerId === me.accountId ? "bạn" : me.partnerNickname;
  return (
    <>
      <AppNav me={me} current="dau-thoi-gian" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">{book.title}</h1>
            <p className="head__sub">{`Sách của ${chu}. Bìa và nhạc của cuốn này theo từng ngày.`}</p>
          </div>
        </div>
        <LichDau
          key={thangKhoa(thang)}
          thang={thang}
          tuan={luoiThang(thang, homNay)}
          ngay={hien}
          chonDau={ngayMacDinh(theoNgay, homNay, soNgayCua(thang))}
          now={now}
          truocHref={thangKhoa(thang) === thangKhoa(tao) ? null : duong(thangTruoc(thang))}
          sauHref={nay ? null : duong(thangSau(thang))}
        />
      </main>
    </>
  );
}

import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { findReadableBook } from "@/server/library/books";
import { coverSlots, trackSlots } from "@/server/library/timeline";
import { tenCacBai } from "@/server/media/ten-youtube";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { LichDau, type DauHien } from "@/components/dau-thoi-gian/LichDau";
import { docThangSach, gomTheoNgay, ngayMacDinh, thangMacDinh, xepTheoDong, type Dau } from "@/lib/dau-thoi-gian";
import { pageRange } from "@/lib/seal/reader";
import { laThangNay, ngayTrongThang, soNgayCua, thangCua, thangKhoa } from "@/lib/tam-trang/lich";
import { timeLabel } from "@/lib/when";

/**
 * Dau thoi gian cua MOT cuon: hai dong thoi gian bia va nhac tren mot lich thang cung khung voi Lich hoa (spec bo sung
 * B4 ban hai). Hai phep doc chay song song, khong mot phep doc nao theo tung thang: trang gui MOI dau cua cuon, da dung
 * san chu, thang va ngay theo gio Viet Nam, de trinh duyet doi thang tai cho ma nhac khong bi ngat. Ten bai nhac lay tu
 * YouTube o phia may chu (tenCacBai), lay khong duoc thi thoi. Trang khong doc va khong hien mot chu nao cua noi dung
 * to, nen niem phong khong lien quan; "Đọc từ trang N" dan toi man doc, noi moi luat niem phong van giu nguyen.
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
  const tao = thangCua(book.createdAt);
  const thang = docThangSach(query.thang, tao, thangNay, thangMacDinh(dau, now));
  const homNay = ngayTrongThang(now);
  const ten = await tenCacBai(dau.flatMap((d) => (d.loai === "nhac" && d.youtubeId !== null ? [d.youtubeId] : [])));

  // Moi chu dung san o may chu, de lan ve dau cua trinh duyet khong lech voi HTML may chu gui xuong.
  const hien = xepTheoDong(dau).map((d): DauHien => {
    const chung = {
      key: d.key,
      luot: d.ordinal === null ? "mo-dau" : `luot-${d.ordinal}`,
      tenLuot: d.ordinal === null ? "Lúc tạo sách" : `Lượt ${d.ordinal}`,
      nhan: d.ordinal === null ? "Lúc tạo sách" : `Lượt ${d.ordinal}, ${pageRange(d.first ?? 0, d.last ?? 0)}`,
      gio: timeLabel(d.at),
      docHref: d.first === null ? `/sach/${book.id}` : `/sach/${book.id}?trang=${d.first}`,
      docNhan: d.first === null ? "Đọc từ đầu" : `Đọc từ trang ${d.first}`,
      thang: thangKhoa(thangCua(d.at)),
      ngay: ngayTrongThang(d.at),
    };
    if (d.loai === "bia") return Object.assign(chung, { loai: "bia" as const, cover: d.cover, coverMediaId: d.coverMediaId });
    const bai = d.youtubeId === null ? undefined : ten[d.youtubeId];
    return Object.assign(chung, { loai: "nhac" as const, youtubeId: d.youtubeId, ten: bai?.ten ?? null, kenh: bai?.kenh ?? null });
  });

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
          dau={hien}
          thangDau={thang}
          chonDau={ngayMacDinh(gomTheoNgay(dau, thang), laThangNay(thang, now) ? homNay : null, soNgayCua(thang))}
          tao={tao}
          thangNay={thangNay}
          homNay={homNay}
          now={now}
        />
      </main>
    </>
  );
}

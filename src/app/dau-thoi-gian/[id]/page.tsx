import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { findReadableBook } from "@/server/library/books";
import { coverSlots, trackSlots } from "@/server/library/timeline";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { LuoiNam, type DauHien, type ThangHien } from "@/components/dau-thoi-gian/LuoiNam";
import { docNam, gomTheoThang, namMacDinh, namThang, thangMacDinh, type Dau } from "@/lib/dau-thoi-gian";
import { pageRange } from "@/lib/seal/reader";
import { dateLabel } from "@/lib/when";

/**
 * Dau thoi gian cua MOT cuon: hai dong thoi gian bia va nhac gom theo thang cua mot nam. Hai phep doc chay song song,
 * khong mot phep doc nao theo tung thang. Trang khong doc va khong hien mot chu nao cua noi dung to, nen niem phong
 * khong lien quan; "Đọc từ trang N" dan toi man doc, noi moi luat niem phong van giu nguyen.
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

  const namTao = namThang(book.createdAt).nam;
  const namNay = namThang(now).nam;
  const nam = docNam(query.nam, namTao, namNay, namMacDinh(dau, now));
  const oThang = gomTheoThang(dau, nam);

  // Moi chu dung san o may chu, de lan ve dau cua trinh duyet khong lech voi HTML may chu gui xuong.
  const hien: ThangHien[] = oThang.map((o) => ({
    thang: o.thang,
    dau: o.dau.map((d): DauHien => {
      const chung = {
        key: d.key,
        nhan: d.ordinal === null ? "Lúc tạo sách" : `Lượt ${d.ordinal}, ${pageRange(d.first ?? 0, d.last ?? 0)}`,
        ngay: dateLabel(d.at, now),
        docHref: d.first === null ? `/sach/${book.id}` : `/sach/${book.id}?trang=${d.first}`,
        docNhan: d.first === null ? "Đọc từ đầu" : `Đọc từ trang ${d.first}`,
      };
      return d.loai === "bia"
        ? { ...chung, loai: "bia", cover: d.cover, coverMediaId: d.coverMediaId }
        : { ...chung, loai: "nhac", go: d.youtubeId === null };
    }),
  }));

  const chu = book.ownerId === me.accountId ? "bạn" : me.partnerNickname;
  return (
    <>
      <AppNav me={me} current="dau-thoi-gian" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">{book.title}</h1>
            <p className="head__sub">{`Sách của ${chu}. Bìa và nhạc của cuốn này theo thời gian.`}</p>
          </div>
        </div>
        <LuoiNam
          key={nam}
          nam={nam}
          oThang={hien}
          chonDau={thangMacDinh(oThang)}
          namTruocHref={nam > namTao ? `/dau-thoi-gian/${book.id}?nam=${nam - 1}` : null}
          namSauHref={nam < namNay ? `/dau-thoi-gian/${book.id}?nam=${nam + 1}` : null}
        />
      </main>
    </>
  );
}

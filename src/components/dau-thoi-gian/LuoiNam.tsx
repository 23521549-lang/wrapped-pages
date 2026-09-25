"use client";

import { useState } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { MuiTen, NotNhac } from "@/components/glyph";
import type { CoverKey } from "@/lib/book";

/**
 * Mot dau da dung san o may chu de ve: nhan, ngay va duong doc deu la chu co san, trinh duyet khong tinh gi. Nho vay
 * lan ve dau cua trinh duyet khong lech voi HTML may chu gui xuong, va thanh phan trinh duyet nay chi nhan DUNG nhung
 * gi no ve ra - khong mot chu nao cua noi dung to.
 */
export type DauHien = {
  key: string;
  /** "Lúc tạo sách" hay "Lượt 3, trang 12 tới 17". */
  nhan: string;
  /** Ngay theo dinh dang chung cua web. */
  ngay: string;
  /** Man doc cua cuon, mo o to dau cua luot. */
  docHref: string;
  /** "Đọc từ trang 12", hay "Đọc từ đầu" voi o mo dau. */
  docNhan: string;
} & (
  | { loai: "bia"; cover: CoverKey; coverMediaId: string | null }
  | { loai: "nhac"; go: boolean }
);

export type ThangHien = { thang: number; dau: DauHien[] };

export type LuoiNamProps = {
  nam: number;
  oThang: readonly ThangHien[];
  /** Thang chon san: thang cua dau moi nhat trong nam; null khi ca nam trong. */
  chonDau: number | null;
  namTruocHref: string | null;
  namSauHref: string | null;
};

/** Chu cua mot dong trong khung chi tiet. */
function chuDau(d: DauHien): string {
  if (d.loai === "bia") return d.nhan;
  return d.go ? `Gỡ nhạc nền, ${d.nhan.charAt(0).toLowerCase()}${d.nhan.slice(1)}` : `Nhạc nền, ${d.nhan.charAt(0).toLowerCase()}${d.nhan.slice(1)}`;
}

/**
 * Luoi muoi hai thang cua mot nam va khung chi tiet cua thang dang chon, dung tinh than Lich hoa: doi nam bang lien ket
 * that, bam mot thang thi khung chi tiet doi TAI CHO. Khong mot hoat anh nao.
 */
export function LuoiNam({ nam, oThang, chonDau, namTruocHref, namSauHref }: LuoiNamProps) {
  const [chon, setChon] = useState(chonDau);
  const dangChon = chon === null ? null : oThang[chon - 1];
  const tong = oThang.reduce((n, o) => n + o.dau.length, 0);

  return (
    <div className="lich-trang">
      <div>
        <div className="thang">
          {namTruocHref === null ? (
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Năm trước" disabled><MuiTen huong="trai" /></button>
          ) : (
            <Link className="btn btn--quiet btn--icon" href={namTruocHref} aria-label="Năm trước"><MuiTen huong="trai" /></Link>
          )}
          {/* Khong phai vung aria-live: doi nam bang lien ket that nen tieu de nay khong bao gio doi tai cho. */}
          <h2 className="d">{`Năm ${nam}`}</h2>
          {namSauHref === null ? (
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Năm sau" disabled><MuiTen huong="phai" /></button>
          ) : (
            <Link className="btn btn--quiet btn--icon" href={namSauHref} aria-label="Năm sau"><MuiTen huong="phai" /></Link>
          )}
          <p className="thang__tong"><b>{tong}</b> dấu trong năm</p>
        </div>
        <fieldset className="nam-luoi">
          <legend className="sr-only">{`Mười hai tháng của năm ${nam}`}</legend>
          {oThang.map((o) => {
            const bia = o.dau.filter((d) => d.loai === "bia").length;
            const nhac = o.dau.length - bia;
            const nhan = `Tháng ${o.thang}: ${o.dau.length === 0 ? "chưa có dấu nào" : `${bia} bìa, ${nhac} dấu nhạc`}`;
            return (
              <button
                key={o.thang}
                type="button"
                className={o.dau.length === 0 ? "nam-o nam-o--trong" : "nam-o"}
                aria-pressed={chon === o.thang}
                aria-label={nhan}
                onClick={() => setChon(o.thang)}
              >
                <span className="nam-o__ten" aria-hidden="true">{`Tháng ${o.thang}`}</span>
                <span className="nam-o__dau" aria-hidden="true">
                  {o.dau.map((d) => (d.loai === "bia" ? (
                    <span key={d.key} className={`nam-tem bia--${d.cover}`}>
                      <CoverArt cover={d.cover} />
                      <CoverImage mediaId={d.coverMediaId} />
                    </span>
                  ) : (
                    <span key={d.key} className="nam-not"><NotNhac go={d.go} /></span>
                  )))}
                </span>
              </button>
            );
          })}
        </fieldset>
      </div>

      <div className="phu">
        {/* Khung nay doi TAI CHO khi bam mot o thang, va focus o yen tren o vua bam, nen noi dung moi chi duoc doc ra
            neu no la mot vung live. */}
        <section className="chi-tiet" aria-live="polite">
          <div className="chi-tiet__dau">
            <h2 className="d">{dangChon === null ? `Năm ${nam}` : `Tháng ${dangChon.thang}, ${nam}`}</h2>
          </div>
          {dangChon === null || dangChon.dau.length === 0 ? (
            <p className="chi-tiet__trong">{dangChon === null ? "Năm này chưa có dấu nào." : "Tháng này chưa có dấu nào."}</p>
          ) : (
            <ol className="dtg-ct">
              {dangChon.dau.map((d) => (
                <li key={d.key} className="dtg-ct__dong">
                  {d.loai === "bia" ? (
                    <span className={`dtg-ct__hinh bia--${d.cover}`} aria-hidden="true">
                      <CoverArt cover={d.cover} />
                      <CoverImage mediaId={d.coverMediaId} />
                    </span>
                  ) : (
                    <span className="dtg-ct__hinh dtg-ct__hinh--nhac" aria-hidden="true"><NotNhac go={d.go} /></span>
                  )}
                  <p className="dtg-ct__chu">
                    {chuDau(d)}
                    <span className="dtg-ct__ngay">{d.ngay}</span>
                  </p>
                  <Link className="btn btn--chu dtg-ct__doc" href={d.docHref}>
                    {d.docNhan}
                    <span className="sr-only">{`, ${chuDau(d).toLowerCase()}`}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

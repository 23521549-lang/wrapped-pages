"use client";

import { useState } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { MuiTen, NotNhac } from "@/components/glyph";
import type { CoverKey } from "@/lib/book";
import { tenNgay, type Thang, type TuanLich } from "@/lib/tam-trang/lich";

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * Mot dau da dung san o may chu de ve: nhan, gio va duong doc deu la chu co san, trinh duyet khong tinh gi. Nho vay
 * lan ve dau cua trinh duyet khong lech voi HTML may chu gui xuong, va thanh phan trinh duyet nay chi nhan DUNG nhung
 * gi no ve ra - khong mot chu nao cua noi dung to.
 */
export type DauHien = {
  key: string;
  /** Khoa cua luot dat dau nay ("mo-dau" hay "luot-3"): bia va nhac cua cung mot luot chung mot dong chi tiet. */
  luot: string;
  /** "Lúc tạo sách" hay "Lượt 3, trang 12 tới 17". */
  nhan: string;
  /** Gio trong ngay, 21:40. */
  gio: string;
  /** Man doc cua cuon, mo o to dau cua luot. */
  docHref: string;
  /** "Đọc từ trang 12", hay "Đọc từ đầu" voi o mo dau. */
  docNhan: string;
} & (
  | { loai: "bia"; cover: CoverKey; coverMediaId: string | null }
  | { loai: "nhac"; go: boolean }
);

export type LichDauProps = {
  thang: Thang;
  tuan: readonly TuanLich[];
  /** Dau theo ngay trong thang, moi ngay theo thu tu dong thoi gian. Ngay khong co dau thi khong co khoa. */
  ngay: Readonly<Record<number, readonly DauHien[]>>;
  chonDau: number;
  now: Date;
  truocHref: string | null;
  sauHref: string | null;
};

type BiaHien = Extract<DauHien, { loai: "bia" }>;
type NhacHien = Extract<DauHien, { loai: "nhac" }>;

/** Cac dau cua mot luot trong ngay: moi luot co nhieu nhat mot o bia va mot o nhac. */
export type NhomLuot = { key: string; nhan: string; gio: string; docHref: string; docNhan: string; bia: BiaHien | null; nhac: NhacHien | null };

/**
 * Gom cac dau cua mot ngay theo luot, giu thu tu dong thoi gian: bia va nhac cua cung mot luot la MOT dong chi tiet voi
 * mot lien ket doc, khong phai hai dong lap lai cung cho doc.
 */
export function gomTheoLuot(dau: readonly DauHien[]): NhomLuot[] {
  const nhom: NhomLuot[] = [];
  for (const d of dau) {
    let n = nhom.find((x) => x.key === d.luot);
    if (n === undefined) {
      n = { key: d.luot, nhan: d.nhan, gio: d.gio, docHref: d.docHref, docNhan: d.docNhan, bia: null, nhac: null };
      nhom.push(n);
    }
    if (d.loai === "bia") n.bia = d;
    else n.nhac = d;
  }
  return nhom;
}

/** Luot nay doi gi: "Bìa mới, nhạc mới", "Bìa mới", "Gỡ nhạc"... */
export function moTaLuot(n: NhomLuot): string {
  const phan = [n.bia === null ? null : "bìa mới", n.nhac === null ? null : n.nhac.go ? "gỡ nhạc" : "nhạc mới"].filter((x) => x !== null);
  const chu = phan.join(", ");
  return `${chu.charAt(0).toUpperCase()}${chu.slice(1)}`;
}

function TemBia({ d, className }: { d: BiaHien; className: string }) {
  return (
    <span className={`${className} bia--${d.cover}`} aria-hidden="true">
      <CoverArt cover={d.cover} />
      <CoverImage mediaId={d.coverMediaId} />
    </span>
  );
}

/** So dau cung loai trong ngay, chi hien khi nhieu hon mot. Nhan cua o ngay da doc du tung dau nen so nay an voi trinh doc. */
function Dem({ n }: { n: number }) {
  return n > 1 ? <span className="dtg-dem" aria-hidden="true">{n}</span> : null;
}

/**
 * Lan bia cua mot o ngay: bia cuoi cung dat trong ngay; nhieu bia thi tem xep chong mot lop phia sau va mot con so nho.
 * Ngay khong co bia nao thi la vong cham mo.
 */
function LanBia({ dau }: { dau: readonly DauHien[] }) {
  const bia = dau.filter((d): d is BiaHien => d.loai === "bia");
  const cuoi = bia.at(-1);
  if (cuoi === undefined) return <span className="hoa-trong" />;
  return (
    <span className="dtg-lan">
      <TemBia d={cuoi} className={bia.length > 1 ? "dtg-tem dtg-tem--chong" : "dtg-tem"} />
      <Dem n={bia.length} />
    </span>
  );
}

/** Lan nhac cua mot o ngay: not nhac (gach cheo khi la go nhac) cua dau nhac cuoi cung trong ngay, kem so khi nhieu hon mot. */
function LanNhac({ dau }: { dau: readonly DauHien[] }) {
  const nhac = dau.filter((d): d is NhacHien => d.loai === "nhac");
  const cuoi = nhac.at(-1);
  if (cuoi === undefined) return <span className="hoa-trong" />;
  return (
    <span className="dtg-lan">
      <span className="dtg-not"><NotNhac go={cuoi.go} /></span>
      <Dem n={nhac.length} />
    </span>
  );
}

/**
 * Lich thang cua mot cuon, cung khung voi Lich hoa (tam-trang.css: .lich-trang, .thang, .lich, .tuan, .ngay, .chi-tiet):
 * doi thang bang lien ket that, moi ngay mot o bam duoc voi hai lan - lan tren la bia, lan duoi la nhac, thay cho hai
 * nguoi cua Lich hoa. Bam mot ngay thi khung chi tiet doi TAI CHO, nen no la mot vung aria-live. Khong mot hoat anh nao.
 */
export function LichDau({ thang, tuan, ngay, chonDau, now, truocHref, sauHref }: LichDauProps) {
  const [chon, setChon] = useState(chonDau);
  const cacDau = Object.values(ngay).flat();
  const demBia = cacDau.filter((d) => d.loai === "bia").length;
  const demNhac = cacDau.length - demBia;
  const dangChon = gomTheoLuot(ngay[chon] ?? []);

  return (
    <div className="lich-trang">
      <div>
        <div className="thang">
          {truocHref === null ? (
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Tháng trước" disabled><MuiTen huong="trai" /></button>
          ) : (
            <Link className="btn btn--quiet btn--icon" href={truocHref} aria-label="Tháng trước"><MuiTen huong="trai" /></Link>
          )}
          {/* Khong phai vung aria-live: trang doi thang bang lien ket that nen tieu de nay khong bao gio doi tai cho. */}
          <h2 className="d">{`Tháng ${thang.m}, ${thang.y}`}</h2>
          {sauHref === null ? (
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Tháng sau" disabled><MuiTen huong="phai" /></button>
          ) : (
            <Link className="btn btn--quiet btn--icon" href={sauHref} aria-label="Tháng sau"><MuiTen huong="phai" /></Link>
          )}
          <p className="thang__tong"><b>{demBia}</b> bìa, <b>{demNhac}</b> dấu nhạc trong tháng</p>
        </div>
        <p className="lich__chu">Hàng trên là <b>bìa</b>, hàng dưới là <b>nhạc</b>.</p>
        <fieldset className="lich">
          <legend className="sr-only">{`Lịch tháng ${thang.m}`}</legend>
          <div className="lich__thu" aria-hidden="true">
            <span />
            {THU.map((t) => <span key={t}>{t}</span>)}
          </div>
          {tuan.map((t) => (
            <div key={t.key} className={t.xa ? "tuan tuan--xa" : "tuan"}>
              <div className="tuan__nhan" aria-hidden="true"><span /><span>Bìa</span><span>Nhạc</span></div>
              {t.o.map((o) => {
                const so = o.ngay;
                if (so === null) return <span key={o.key} aria-hidden="true" />;
                if (o.tuongLai) {
                  return (
                    <span key={o.key} className="ngay ngay--xa" aria-hidden="true">
                      <span className="ngay__so">{so}</span><span /><span />
                    </span>
                  );
                }
                const d = ngay[so] ?? [];
                const luot = gomTheoLuot(d).map((n) => `${n.nhan}: ${moTaLuot(n).toLowerCase()}`);
                const nhan = `${so} tháng ${thang.m}. ${luot.length === 0 ? "Không có dấu nào" : luot.join(". ")}${o.homNay ? ". Hôm nay" : ""}`;
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={o.homNay ? "ngay ngay--nay" : "ngay"}
                    aria-pressed={chon === so}
                    aria-label={nhan}
                    onClick={() => setChon(so)}
                  >
                    <span className="ngay__so" aria-hidden="true">{so}</span>
                    <LanBia dau={d} />
                    <LanNhac dau={d} />
                  </button>
                );
              })}
            </div>
          ))}
        </fieldset>
      </div>

      <div className="phu">
        {/* Khung nay doi TAI CHO khi bam mot ngay, va focus o yen tren o vua bam, nen noi dung moi chi duoc doc ra neu no
            la mot vung live. */}
        <section className="chi-tiet" aria-live="polite">
          <div className="chi-tiet__dau">
            <h2 className="d">{tenNgay(thang, chon, now)}</h2>
          </div>
          {dangChon.length === 0 ? (
            <p className="chi-tiet__trong">Ngày này không có dấu nào.</p>
          ) : (
            <ol className="dtg-ct">
              {dangChon.map((n) => (
                <li key={n.key} className="dtg-ct__dong">
                  {n.bia === null ? (
                    <span className="dtg-ct__hinh dtg-ct__hinh--nhac" aria-hidden="true"><NotNhac go={n.nhac?.go ?? false} /></span>
                  ) : (
                    <TemBia d={n.bia} className="dtg-ct__hinh" />
                  )}
                  <p className="dtg-ct__chu">
                    {n.nhan}
                    <span className="dtg-ct__ngay">{`${moTaLuot(n)}, ${n.gio}`}</span>
                  </p>
                  <Link className="btn btn--chu dtg-ct__doc" href={n.docHref}>
                    {n.docNhan}
                    <span className="sr-only">{`, ${n.nhan.toLowerCase()}`}</span>
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

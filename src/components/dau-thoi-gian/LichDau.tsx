"use client";

import { useMemo, useRef, useState } from "react";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { MuiTen } from "@/components/glyph";
import type { CoverKey } from "@/lib/book";
import { baiPhatDuoc, gomTheoThang } from "@/lib/dau-thoi-gian";
import { luoiThang, tenNgay, thangKhoa, thangSau, thangTruoc, type Thang } from "@/lib/tam-trang/lich";
import { NhacNgay, type BaiNgay, type DieuKhienNhac } from "./NhacNgay";
import { XemBia, type BiaXem } from "./XemBia";

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * Mot dau da dung san o may chu de ve: chu, thang va ngay (gio Viet Nam) deu co san, trinh duyet khong tinh mui gio
 * nao. Thanh phan nay chi nhan DUNG nhung gi no ve ra - khong mot chu nao cua noi dung to.
 */
export type DauHien = {
  key: string;
  /** Khoa cua luot dat dau nay ("mo-dau" hay "luot-3"): bia va nhac cua cung mot luot la mot luot dang. */
  luot: string;
  /** "Lượt 3" hay "Lúc tạo sách". */
  tenLuot: string;
  /** "Lượt 3, trang 12 tới 17" hay "Lúc tạo sách". */
  nhan: string;
  /** Gio trong ngay, 21:40. */
  gio: string;
  /** Man doc cua cuon, mo o to dau cua luot. */
  docHref: string;
  /** "Đọc từ trang 12", hay "Đọc từ đầu" voi o mo dau. */
  docNhan: string;
  /** Thang cua dau, "2026-09". */
  thang: string;
  /** Ngay trong thang. */
  ngay: number;
} & (
  | { loai: "bia"; cover: CoverKey; coverMediaId: string | null }
  | { loai: "nhac"; youtubeId: string | null; ten: string | null; kenh: string | null }
);

type BiaHien = Extract<DauHien, { loai: "bia" }>;
type NhacHien = Extract<DauHien, { loai: "nhac" }>;
const laBia = (d: DauHien): d is BiaHien => d.loai === "bia";
const laNhac = (d: DauHien): d is NhacHien => d.loai === "nhac";

export type LichDauProps = {
  /** Moi dau cua cuon, theo thu tu dong thoi gian. */
  dau: readonly DauHien[];
  /** Thang mo san (tu ?thang hay thang cua dau moi nhat) va ngay chon san trong thang do. */
  thangDau: Thang;
  chonDau: number;
  /** Thang tao sach va thang nay: hai dau mut cua nut doi thang. */
  tao: Thang;
  thangNay: Thang;
  /** Ngay hom nay trong thang nay, gio Viet Nam. */
  homNay: number;
  now: Date;
};

/** Xap bia nho trong o ngay: toi da ba la xoe nghieng, la dau (bia cua luot dau tien trong ngay) nam tren cung. */
function XapNho({ bia }: { bia: readonly BiaHien[] }) {
  return (
    <span className="dtg-xap" aria-hidden="true">
      {bia.slice(0, 3).map((b) => (
        <span key={b.key} className={`dtg-xap__la bia bia--${b.cover}`}>
          <CoverArt cover={b.cover} />
          <CoverImage mediaId={b.coverMediaId} />
        </span>
      ))}
    </span>
  );
}

/** Cham nhac trong o ngay: moi lan doi nhac mot cham, toi da ba; go nhac la cham rong. */
function ChamNhac({ nhac }: { nhac: readonly NhacHien[] }) {
  return (
    <span className="dtg-cham" aria-hidden="true">
      {nhac.slice(0, 3).map((d) => (
        <span key={d.key} className={d.youtubeId === null ? "dtg-cham__mot dtg-cham__mot--go" : "dtg-cham__mot"} />
      ))}
    </span>
  );
}

const baiNgay = (ds: readonly DauHien[]): BaiNgay[] =>
  ds.filter(laNhac).map((d) => ({ key: d.key, youtubeId: d.youtubeId, ten: d.ten, kenh: d.kenh, tenLuot: d.tenLuot, gio: d.gio }));

/**
 * Trang Dau thoi gian cua mot cuon (spec bo sung B4 ban hai): lich thang gon cung khung voi Lich hoa ben trai, cot phai
 * rong gom the ngay (xap bia lon mo trinh xem bia) va the Nhac trong ngay. Doi thang ngay tai cho (duong dan van ghi
 * ?thang=) nen ngay dang chon, cot phai va bai dang phat giu nguyen. Nhac chi tu phat khi bam mot ngay.
 */
export function LichDau({ dau, thangDau, chonDau, tao, thangNay, homNay, now }: LichDauProps) {
  const theoThang = useMemo(() => gomTheoThang(dau), [dau]);
  const [thang, setThang] = useState(thangDau);
  const [chon, setChon] = useState({ thang: thangDau, so: chonDau });
  const [xem, setXem] = useState<{ bia: BiaXem[]; cao: number } | null>(null);
  const nhacRef = useRef<DieuKhienNhac>(null);
  const nhacKhungRef = useRef<HTMLElement>(null);

  const khoa = thangKhoa(thang);
  const trongThang = theoThang[khoa] ?? {};
  const cacDauThang = Object.values(trongThang).flat();
  const demBia = cacDauThang.filter(laBia).length;
  const demNhac = cacDauThang.length - demBia;
  const nay = khoa === thangKhoa(thangNay);

  const dauChon = theoThang[thangKhoa(chon.thang)]?.[chon.so] ?? [];
  const biaChon = dauChon.filter(laBia);
  const soLuot = new Set(dauChon.map((d) => d.luot)).size;
  const dsNhac = baiNgay(dauChon);
  const coMay = baiPhatDuoc(dsNhac, 0) >= 0;
  const tenNgayChon = tenNgay(chon.thang, chon.so, now);

  const doiThang = (t: Thang) => {
    setThang(t);
    // Chi doi duong dan, khong dieu huong: tai lai hay gui link van mo dung thang nay, ma nhac khong bi ngat.
    globalThis.history.replaceState(null, "", `?thang=${thangKhoa(t)}`);
  };

  const bamNgay = (so: number) => {
    const cungNgay = thangKhoa(chon.thang) === khoa && chon.so === so;
    setChon({ thang, so });
    nhacRef.current?.chonNgay(baiNgay(trongThang[so] ?? []), cungNgay);
  };

  return (
    <div className={xem === null ? "dtg" : "dtg dtg--xem"}>
      <div className="dtg-trang">
        <section className="dtg-lich" aria-labelledby="dtg-thang">
          <div className="thang">
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Tháng trước" disabled={khoa === thangKhoa(tao)} onClick={() => doiThang(thangTruoc(thang))}>
              <MuiTen huong="trai" />
            </button>
            {/* Doi thang tai cho nen tieu de nay doi tai cho: vung aria-live de trinh doc man hinh doc thang moi. */}
            <h2 className="d" id="dtg-thang" aria-live="polite">{`Tháng ${thang.m}, ${thang.y}`}</h2>
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Tháng sau" disabled={nay} onClick={() => doiThang(thangSau(thang))}>
              <MuiTen huong="phai" />
            </button>
            <p className="thang__tong"><b>{demBia}</b> bìa, <b>{demNhac}</b> lần đổi nhạc trong tháng</p>
          </div>
          <p className="lich__chu">Hàng trên là <b>bìa</b>, hàng dưới là <b>nhạc</b>.</p>
          <fieldset className="lich lich--dtg">
            <legend className="sr-only">{`Lịch tháng ${thang.m}`}</legend>
            <div className="lich__thu" aria-hidden="true">
              <span />
              {THU.map((t) => <span key={t}>{t}</span>)}
            </div>
            {luoiThang(thang, nay ? homNay : null).map((t) => (
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
                  const d = trongThang[so] ?? [];
                  const bia = d.filter(laBia);
                  const nhac = d.filter(laNhac);
                  const tom = d.length === 0 ? "Không có dấu nào" : `${bia.length} bìa, ${nhac.length} lần đổi nhạc`;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      className={o.homNay ? "ngay ngay--nay" : "ngay"}
                      aria-pressed={thangKhoa(chon.thang) === khoa && chon.so === so}
                      aria-label={`${so} tháng ${thang.m}. ${tom}${o.homNay ? ". Hôm nay" : ""}`}
                      onClick={() => bamNgay(so)}
                    >
                      <span className="ngay__so" aria-hidden="true">{so}</span>
                      {bia.length > 0 ? <XapNho bia={bia} /> : <span className="hoa-trong dtg-trong" />}
                      {nhac.length > 0 ? <ChamNhac nhac={nhac} /> : <span className="hoa-trong dtg-trong dtg-trong--nhac" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </fieldset>
        </section>

        <aside className="dtg-phu" aria-label="Chi tiết ngày">
          {/* The nay doi TAI CHO khi bam mot ngay, va focus o yen tren o vua bam, nen noi dung moi chi duoc doc ra neu no
              la mot vung live. */}
          <section className="dtg-the" aria-live="polite">
            <div className="dtg-ngay">
              <h2 className="d">{tenNgayChon}</h2>
              <p>{dauChon.length === 0 ? "Ngày này không có dấu nào." : `${soLuot} lượt đăng: ${biaChon.length} bìa mới, ${dsNhac.length} lần đổi nhạc.`}</p>
            </div>
            {biaChon.length === 0 ? (
              <p className="dtg-khong-bia">{dauChon.length === 0 ? "Chọn một ngày có xấp bìa trên lịch để xem." : "Ngày này không đổi bìa."}</p>
            ) : (
              <button
                type="button"
                className="dtg-xl"
                aria-label={`Xem ${biaChon.length} bìa của ngày này`}
                onClick={() => setXem({ bia: biaChon, cao: nhacKhungRef.current?.offsetHeight ?? 0 })}
              >
                <span className="dtg-xl__khung" aria-hidden="true">
                  {biaChon.slice(0, 3).map((b) => (
                    <span key={b.key} className="dtg-xl__to">
                      <span className={`bia bia--${b.cover}`}>
                        <CoverArt cover={b.cover} />
                        <CoverImage mediaId={b.coverMediaId} />
                      </span>
                    </span>
                  ))}
                </span>
                <span className="dtg-xl__chu" aria-hidden="true">
                  <span><b>{`${biaChon.length} bìa`}</b> trong ngày</span>
                  <span>Bấm để xem từng bìa</span>
                </span>
              </button>
            )}
          </section>
          {/* Luc the nhac noi len goc man hinh, cho nay giu dung chieu cao cu cua no: cot phai khong co lai. */}
          {xem !== null && coMay && <div className="dtg-nhac-cho" style={{ height: xem.cao }} />}
          <NhacNgay ref={nhacRef} khungRef={nhacKhungRef} ds={dsNhac} noi={xem !== null} />
        </aside>
      </div>
      {xem !== null && (
        <XemBia bia={xem.bia} tenNgay={tenNgayChon} giuRef={coMay ? nhacKhungRef : null} onDong={() => setXem(null)} />
      )}
    </div>
  );
}

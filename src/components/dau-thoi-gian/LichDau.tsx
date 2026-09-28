"use client";

import { useMemo, useRef, useState } from "react";
import { MuiTen, NotNhac } from "@/components/glyph";
import { gomTheoThang } from "@/lib/dau-thoi-gian";
import { luoiThang, tenNgay, thangKhoa, thangSau, thangTruoc, type Thang } from "@/lib/tam-trang/lich";
import { NhacNgay, type BaiNgay, type DieuKhienNhac } from "./NhacNgay";

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * Mot dau nhac da dung san o may chu de ve: chu, thang va ngay (gio Viet Nam) deu co san, trinh duyet khong tinh mui
 * gio nao. Thanh phan nay chi nhan DUNG nhung gi no ve ra - khong mot chu nao cua noi dung to.
 */
export type DauHien = {
  key: string;
  /** Khoa cua luot dat dau nay ("mo-dau" hay "luot-3"), de dem so luot dang trong mot ngay. */
  luot: string;
  /** "Lượt 3" hay "Lúc tạo sách". */
  tenLuot: string;
  /** Gio trong ngay, 21:40. */
  gio: string;
  /** Thang cua dau, "2026-09". */
  thang: string;
  /** Ngay trong thang. */
  ngay: number;
  /** null la o go nhac. */
  youtubeId: string | null;
  /** Ten bai va kenh tu YouTube; null khi may chu khong lay duoc. */
  ten: string | null;
  kenh: string | null;
};

export type LichDauProps = {
  /** Moi dau nhac cua cuon, theo thu tu dong thoi gian. */
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

/** Not nhac trong o ngay: moi lan doi nhac mot not, toi da ba; go nhac la not gach cheo. */
function NotNgay({ nhac }: { nhac: readonly DauHien[] }) {
  return (
    <span className="dtg-not" aria-hidden="true">
      {nhac.slice(0, 3).map((d) => (
        <span key={d.key} className={d.youtubeId === null ? "dtg-not__mot dtg-not__mot--go" : "dtg-not__mot"}>
          <NotNhac go={d.youtubeId === null} />
        </span>
      ))}
    </span>
  );
}

const baiNgay = (ds: readonly DauHien[]): BaiNgay[] =>
  ds.map((d) => ({ key: d.key, youtubeId: d.youtubeId, ten: d.ten, kenh: d.kenh, tenLuot: d.tenLuot, gio: d.gio }));

/**
 * Trang Dau thoi gian cua mot cuon, chi con nhac (chu du an 28/09): lich thang gon cung khung voi Lich hoa ben trai, cot
 * phai la mot the gom ten ngay dang chon va Nhac trong ngay. Doi thang ngay tai cho (duong dan van ghi ?thang=) nen ngay
 * dang chon, cot phai va bai dang phat giu nguyen. Nhac chi tu phat khi bam mot ngay.
 */
export function LichDau({ dau, thangDau, chonDau, tao, thangNay, homNay, now }: LichDauProps) {
  const theoThang = useMemo(() => gomTheoThang(dau), [dau]);
  const [thang, setThang] = useState(thangDau);
  const [chon, setChon] = useState({ thang: thangDau, so: chonDau });
  const nhacRef = useRef<DieuKhienNhac>(null);

  const khoa = thangKhoa(thang);
  const trongThang = theoThang[khoa] ?? {};
  const demThang = Object.values(trongThang).flat().length;
  const nay = khoa === thangKhoa(thangNay);

  const dauChon = theoThang[thangKhoa(chon.thang)]?.[chon.so] ?? [];
  const soLuot = new Set(dauChon.map((d) => d.luot)).size;

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
    <div className="dtg">
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
            <p className="thang__tong"><b>{demThang}</b> lần đổi nhạc trong tháng</p>
          </div>
          <fieldset className="lich lich--dtg">
            <legend className="sr-only">{`Lịch tháng ${thang.m}`}</legend>
            <div className="lich__thu" aria-hidden="true">
              <span />
              {THU.map((t) => <span key={t}>{t}</span>)}
            </div>
            {luoiThang(thang, nay ? homNay : null).map((t) => (
              <div key={t.key} className={t.xa ? "tuan tuan--xa" : "tuan"}>
                <div className="tuan__nhan" aria-hidden="true"><span /><span>Nhạc</span></div>
                {t.o.map((o) => {
                  const so = o.ngay;
                  if (so === null) return <span key={o.key} aria-hidden="true" />;
                  if (o.tuongLai) {
                    return (
                      <span key={o.key} className="ngay ngay--xa" aria-hidden="true">
                        <span className="ngay__so">{so}</span><span />
                      </span>
                    );
                  }
                  const d = trongThang[so] ?? [];
                  const tom = d.length === 0 ? "Không đổi nhạc" : `${d.length} lần đổi nhạc`;
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
                      {d.length > 0 ? <NotNgay nhac={d} /> : <span className="hoa-trong dtg-trong" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </fieldset>
        </section>

        <aside className="dtg-phu" aria-label="Chi tiết ngày">
          <div className="dtg-the">
            {/* Doi TAI CHO khi bam mot ngay, va focus o yen tren o vua bam, nen dong nay phai la mot vung live. */}
            <div className="dtg-ngay" aria-live="polite">
              <h2 className="d">{tenNgay(chon.thang, chon.so, now)}</h2>
              <p>{dauChon.length === 0 ? "Ngày này không đổi nhạc." : `${soLuot} lượt đăng, ${dauChon.length} lần đổi nhạc.`}</p>
            </div>
            <NhacNgay ref={nhacRef} ds={baiNgay(dauChon)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

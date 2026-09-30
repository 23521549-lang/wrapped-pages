"use client";

import { useEffect, useRef, useState } from "react";
import { ChoThu, type ThuKiaHien } from "@/components/thu/ChoThu";
import { msTuCss } from "@/components/reader/Flipbook";
import { giamChuyenDong } from "@/components/thu/chim";
import type { TongKetThang as TongKet } from "@/lib/tam-trang/tong-ket";
import { TROI, type Weather } from "@/lib/tam-trang/troi";
import { nhanThu, type TrangThaiThu } from "@/lib/thu";
import { Hoa } from "./HoaEp";

/** Mot thang da khep, nhu muc tong ket hien: so lieu va cau danh gia (tongKetThang), va cho thu cua thang do. */
export type ThangTongKetHien = {
  /** YYYY-MM. */
  khoa: string;
  /** "Tháng Chín, 2026". */
  ten: string;
  /** "tháng Chín". */
  tenThangChu: string;
  tk: TongKet;
  thu: { tt: TrangThaiThu; kia: ThuKiaHien | null; chuaMo: boolean };
};

const MAU_NEO = /^#thu-(\d{4}-(?:0[1-9]|1[0-2]))$/;

function Mui() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 7.5 10 12.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const tenTroi = (w: Weather) => TROI[w].ten.toLowerCase();

function Nguoi({ ten, so }: { ten: string; so: TongKet["kia"] }) {
  return (
    <div className="thg__nguoi">
      <h4>{ten} <span>{`${so.bong} bông`}</span></h4>
      {so.hoa.length > 0 && (
        <ul className="thg__hoa-ds">
          {so.hoa.map((h) => (
            <li key={h.weather}><Hoa weather={h.weather} /><span><b>{`${h.ngay} ngày`}</b>{` ${tenTroi(h.weather)}`}</span></li>
          ))}
        </ul>
      )}
      {so.chuoi !== null && so.chuoi.dai >= 2 && (
        <p className="thg__chuoi">Chuỗi dài nhất: <b>{`${so.chuoi.dai} ngày liền, từ ${so.chuoi.tu} tới ${so.chuoi.den}`}</b></p>
      )}
    </div>
  );
}

/**
 * Muc "Tổng kết các tháng" duoi Lich hoa (spec 5b D1, D2): dong thang dang chay, roi moi thang da khep mot o thu gon (moi
 * nhat truoc). Dong tom tat: hoa nhieu nhat cua hai nguoi, ten thang, cau danh gia, trang thai thu, mui ten; bam thi tha
 * xuong so lieu cua hai nguoi (nguoi kia truoc), ngay cung mot troi va cho thu. Cung kieu dong thoi gian Sua sach (luoi
 * 0fr toi 1fr). Duong dan #thu-YYYY-MM (dong nhac o Ke sach, dong Hoat dong) mo dung thang va cuon muot toi cho thu.
 */
export function TongKetThang({ thang, nay, tenKia, tenMinh }: {
  thang: readonly ThangTongKetHien[];
  /** Thang dang chay: "Tháng Mười" va ngay mo tong ket "1.11". */
  nay: { ten: string; mo: string; noiBat: Weather | null };
  tenKia: string;
  tenMinh: string;
}) {
  const [mo, setMo] = useState<ReadonlySet<string>>(() => new Set());
  const goc = useRef<HTMLElement>(null);

  // Neo #thu-YYYY-MM: dong bo voi he thong ngoai (duong dan), chi biet sau hydrate. Mo o thang do, cho luoi tha xuong xong
  // roi moi cuon (cuon luc o con gap thi toi sai cho).
  useEffect(() => {
    let hen: ReturnType<typeof setTimeout> | undefined;
    const theoNeo = () => {
      const khoa = MAU_NEO.exec(globalThis.location.hash)?.[1];
      if (khoa === undefined || !thang.some((t) => t.khoa === khoa)) return;
      setMo((cu) => new Set(cu).add(khoa));
      const cho = msTuCss(getComputedStyle(document.documentElement).getPropertyValue("--dur-tha-mo"));
      clearTimeout(hen);
      hen = setTimeout(() => {
        goc.current?.querySelector(`[data-cho-thu="${khoa}"]`)?.scrollIntoView({ behavior: giamChuyenDong() ? "auto" : "smooth", block: "center" });
      }, (Number.isFinite(cho) ? cho : 320) + 60);
    };
    theoNeo();
    addEventListener("hashchange", theoNeo);
    return () => {
      clearTimeout(hen);
      removeEventListener("hashchange", theoNeo);
    };
  }, [thang]);

  const bam = (khoa: string) => setMo((cu) => {
    const moi = new Set(cu);
    if (!moi.delete(khoa)) moi.add(khoa);
    return moi;
  });

  return (
    <section className="tk" aria-labelledby="tk-t" ref={goc}>
      <div className="tk__dau">
        <h2 id="tk-t" className="d">Tổng kết các tháng</h2>
        <p>Mỗi tháng khép lại, hai người viết cho nhau một lá thư.</p>
      </div>
      <p className="tk__nay">
        {nay.noiBat !== null && <Hoa weather={nay.noiBat} />}
        <span><b>{nay.ten}</b>{` đang diễn ra, tổng kết mở vào ngày ${nay.mo}.`}</span>
      </p>
      {thang.map((t) => {
        const dangMo = mo.has(t.khoa);
        const nhan = nhanThu(t.thu.tt, tenKia);
        const hoa = [t.tk.noiBat.kia, t.tk.noiBat.minh].filter((w): w is Weather => w !== null);
        return (
          <section key={t.khoa} className={dangMo ? "thg thg--mo" : "thg"} aria-labelledby={`thg-${t.khoa}-t`}>
            <h3 className="thg__h" id={`thg-${t.khoa}-t`}>
              <button type="button" className="thg__tom" aria-expanded={dangMo} aria-controls={`thg-${t.khoa}`} onClick={() => bam(t.khoa)}>
                <span className="thg__hoa">{hoa.map((w, i) => <Hoa key={`${w}-${i === 0 ? "kia" : "minh"}`} weather={w} />)}</span>
                <span className="thg__chu"><b>{t.ten}</b><span>{t.tk.danhGia}</span></span>
                <span className="thg__tt">
                  {nhan.moi ? <span className="dh dh--moi"><span className="cham" aria-hidden="true" />{nhan.chu}</span> : nhan.chu}
                </span>
                <span className="thg__mui"><Mui /></span>
              </button>
            </h3>
            <div className="thg__mo" id={`thg-${t.khoa}`} inert={!dangMo}>
              <div className="thg__boc">
                <div className="thg__noi">
                  <p className="thg__phu">{t.tk.phu}</p>
                  <div className="thg__so">
                    <Nguoi ten={tenKia} so={t.tk.kia} />
                    <Nguoi ten="Bạn" so={t.tk.minh} />
                  </div>
                  {t.tk.cungTroi.length > 0 && (
                    <div className="thg__cung">
                      <p>{`${t.tk.cungTroi.length} ngày hai người cùng một trời`}</p>
                      <ol>
                        {t.tk.cungTroi.map((c) => (
                          <li key={c.ngay} aria-label={`Ngày ${c.ngay}, cả hai ${tenTroi(c.weather)}`}>
                            <Hoa weather={c.weather} /><span aria-hidden="true">{c.ngay}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="thu">
                    <h4>{`Thư ${t.tenThangChu}`}</h4>
                    <p className="thu__phu">Mỗi người viết một lá cho người kia. Gửi rồi thì không sửa, và không xem lại được thư của mình.</p>
                    <div className="thu__mot" data-cho-thu={t.khoa}>
                      <ChoThu
                        thang={t.khoa}
                        tenThangChu={t.tenThangChu}
                        tenKia={tenKia}
                        tenMinh={tenMinh}
                        tt={t.thu.tt}
                        kia={t.thu.kia}
                        chuaMo={t.thu.chuaMo}
                        mo={dangMo}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </section>
  );
}

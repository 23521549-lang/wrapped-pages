"use client";

import Link from "next/link";
import { useState } from "react";
import { MuiTen } from "@/components/glyph";
import { tenNgay, type HoaNgay, type NgayLich, type Thang, type TuanLich } from "@/lib/tam-trang/lich";
import { TROI, WEATHERS } from "@/lib/tam-trang/troi";
import { Hoa } from "./HoaEp";

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const TRONG: NgayLich = { kia: null, minh: null };

/** Mot lan cua o ngay: bong hoa ep (xoay nhe nhu ep tay) hoac vong cham trong. */
function Lan({ hoa }: { hoa: HoaNgay | null }) {
  return hoa ? <Hoa weather={hoa.weather} xoay={hoa.xoay} /> : <span className="hoa-trong" />;
}

/** Mot dong cua khung chi tiet ngay. */
function DongChiTiet({ ten, hoa }: { ten: string; hoa: HoaNgay | null }) {
  if (!hoa) {
    return (
      <li>
        <span className="hoa-trong" aria-hidden="true" />
        <div><p className="chi-tiet__ai"><b>{ten}</b> chưa thả tâm trạng.</p></div>
      </li>
    );
  }
  const t = TROI[hoa.weather];
  return (
    <li>
      <Hoa weather={hoa.weather} />
      <div>
        <p className="chi-tiet__ai"><b>{ten}</b>: {t.ten.toLowerCase()}</p>
        <p className="chi-tiet__gio">{`${t.tenHoa}, ${hoa.gio}`}</p>
        {hoa.note !== null && <p className="chi-tiet__nhan">{hoa.note}</p>}
      </div>
    </li>
  );
}

/**
 * Lich hoa mot thang: moi tuan mot dong, moi ngay hai lan (tren la nguoi kia, duoi la nguoi xem), moi lan mot bong hoa
 * cua tam trang cuoi cung tha trong ngay. Bam mot ngay de xem chi tiet ben phai (duoi, tren man hep). Chuyen thang la
 * lien ket that (?thang=YYYY-MM); thang nay thi "Thang sau" tat. Ngay tuong lai chi co so, khong bam duoc.
 */
export function LichHoa({ thang, tuan, ngay, homNay, chonDau, now, tenKia, tenMinh, truocHref, sauHref }: {
  thang: Thang;
  tuan: TuanLich[];
  ngay: Record<number, NgayLich>;
  homNay: number | null;
  chonDau: number;
  /** Moc gio cua may chu (Date di qua RSC nguyen ven): tieu de ngay bo nam khi cung nam voi moc nay. */
  now: Date;
  tenKia: string;
  tenMinh: string;
  truocHref: string;
  sauHref: string | null;
}) {
  const [chon, setChon] = useState(chonDau);
  const cacNgay = Object.values(ngay);
  const demKia = cacNgay.filter((d) => d.kia !== null).length;
  const demMinh = cacNgay.filter((d) => d.minh !== null).length;
  const dangChon = ngay[chon] ?? TRONG;

  return (
    <div className="lich-trang">
      <div>
        <div className="thang">
          <Link className="btn btn--quiet btn--icon" href={truocHref} aria-label="Tháng trước"><MuiTen huong="trai" /></Link>
          {/* Khong phai vung aria-live: trang doi thang bang lien ket that nen tieu de nay khong bao gio doi tai cho. */}
          <h2 className="d">{`Tháng ${thang.m}, ${thang.y}`}</h2>
          {sauHref === null ? (
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Tháng sau" disabled><MuiTen huong="phai" /></button>
          ) : (
            <Link className="btn btn--quiet btn--icon" href={sauHref} aria-label="Tháng sau"><MuiTen huong="phai" /></Link>
          )}
          <p className="thang__tong">{tenKia} ép <b>{demKia}</b> bông, {tenMinh} ép <b>{demMinh}</b> bông</p>
        </div>
        <p className="lich__chu">Hàng trên là <b>{tenKia}</b>, hàng dưới là <b>{tenMinh}</b>.</p>
        <fieldset className="lich">
          <legend className="sr-only">{`Lịch tháng ${thang.m}`}</legend>
          <div className="lich__thu" aria-hidden="true">
            <span />
            {THU.map((t) => <span key={t}>{t}</span>)}
          </div>
          {tuan.map((t) => (
            <div key={t.key} className={t.xa ? "tuan tuan--xa" : "tuan"}>
              <div className="tuan__nhan" aria-hidden="true"><span /><span>{tenKia}</span><span>{tenMinh}</span></div>
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
                const d = ngay[so] ?? TRONG;
                const nhan = `${so} tháng ${thang.m}. ${tenKia}: ${d.kia ? TROI[d.kia.weather].ten : "chưa thả"}. ${tenMinh}: ${d.minh ? TROI[d.minh.weather].ten : "chưa thả"}${o.homNay ? ". Hôm nay" : ""}`;
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
                    <Lan hoa={d.kia} />
                    <Lan hoa={d.minh} />
                  </button>
                );
              })}
            </div>
          ))}
        </fieldset>
      </div>

      <div className="phu">
        {/* Nguoc voi tieu de thang o dong 77: khung nay doi TAI CHO khi bam mot o ngay (setChon, khong tai lai trang) va
            focus o yen tren o vua bam, nen khong co gi doc noi dung moi ra neu khong phai vung live. */}
        <section className="chi-tiet" aria-live="polite">
          <div className="chi-tiet__dau">
            <h2 className="d">{tenNgay(thang, chon, now)}</h2>
            {chon === homNay && <span className="chip chip--key">Hôm nay</span>}
          </div>
          <ul>
            <DongChiTiet ten={tenKia} hoa={dangChon.kia} />
            <DongChiTiet ten={tenMinh} hoa={dangChon.minh} />
          </ul>
        </section>
        <section className="chu-giai" aria-label="Chú giải">
          <h2 className="d">Chín bông hoa</h2>
          <ul>
            {WEATHERS.map((w) => (
              <li key={w}>
                <Hoa weather={w} />
                <div><b>{TROI[w].ten}</b><span>{TROI[w].tenHoa}</span></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

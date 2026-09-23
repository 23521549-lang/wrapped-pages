"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { TroiHien } from "@/lib/tam-trang/lich";
import { TROI } from "@/lib/tam-trang/troi";
import { Hoa } from "./HoaEp";
import { NetTroi } from "./NetTroi";
import { ganSong } from "./song";

/** Mot mat cua dai: bau troi lon cua ai, o cua so mang troi cua nguoi con lai (null khi chi mot nguoi co tam trang). */
type Mat = {
  /** "kia" hay "minh": khoa de doi cho, va de do bo cuc cua tung mat. */
  ten: string;
  troi: TroiHien;
  cuaSo: TroiHien | null;
  /** Ten hien cho trinh doc man hinh va cho chu nho duoi o cua so. */
  ai: string;
  aiCuaSo: string;
  laMinh: boolean;
  /** Cau bao khi mat nay thanh troi lon. */
  bao: string;
};

/** Mot bau troi: nen, hai cau tho, nguon, loi nhan, luc tha; o cua so dung truoc phan chu. */
function MotTroi({ m, an }: { m: Mat; an: boolean }) {
  const t = TROI[m.troi.weather];
  return (
    <section
      className={an ? `troi troi--${m.troi.weather} troi--cua-so troi--an` : `troi troi--${m.troi.weather}${m.cuaSo ? " troi--cua-so" : ""}`}
      data-mat={m.cuaSo ? m.ten : undefined}
      data-k={m.troi.weather}
      data-bao={m.bao}
      aria-label={`Tâm trạng của ${m.ai}`}
      inert={an || undefined}
      aria-hidden={an || undefined}
    >
      <div className="troi__nen" aria-hidden="true">
        <NetTroi weather={m.troi.weather} />
      </div>
      <div className="shell troi__chu">
        {m.cuaSo && (
          <button type="button" className="cua-so" aria-label={`Xem trời của ${m.aiCuaSo}`}>
            <span className={`cua-so__kinh troi--${m.cuaSo.weather}`} aria-hidden="true">
              <span className="cua-so__nen"><NetTroi weather={m.cuaSo.weather} /></span>
              <Hoa weather={m.cuaSo.weather} className="cua-so__hoa" />
            </span>
            <span className="cua-so__chu troi__phu" aria-hidden="true">
              {`Trời của ${m.aiCuaSo}`}
              <span className="cua-so__gio">{m.cuaSo.gio}</span>
            </span>
          </button>
        )}
        <div className="troi__noi">
          <p className="sr-only">{`${m.laMinh ? "Bạn" : m.ai}: ${t.ten}.`}</p>
          {m.laMinh && <p className="troi__ai troi__phu">Bạn</p>}
          <p className="troi__dong troi__tho d">
            {t.tho.map((cau) => <span key={cau} className="troi__cau">{cau}</span>)}
          </p>
          {t.giai !== null && <p className="troi__giai troi__phu">{t.giai}</p>}
          <p className="troi__nguon troi__phu">{t.nguon}</p>
          {m.troi.note !== null && <p className="troi__nhan">{m.troi.note}</p>}
          <p className="troi__cuoi">
            <span className="troi__gio troi__phu">{m.troi.tha}</span>
            {!m.laMinh && <Link className="btn btn--chu" href="/tam-trang"><Hoa weather={m.troi.weather} />Xem lịch hoa</Link>}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Dai troi o dau ke sach, che do "O cua so" cua ban mau da duyet. Mac dinh la mot bau troi lon cua nguoi kia; khi nguoi
 * xem cung dang giu tam trang, mot o cua so tron nho mang troi cua ho (thu nho, van chuyen dong, kem bong hoa ep).
 *
 * Ca hai bau troi duoc ve san va xep chong trong CUNG mot o luoi: chieu cao dai luon bang troi cao hon va khong bao gio
 * doi khi doi cho, nen khong co gi ben duoi bi xo dich. Bam vao o cua so thi hai troi doi cho bang mot vong song nuoc
 * lan tu tam o (src/components/tam-trang/song.ts): chi bat/tat lop va chay hoat hinh, khong dung lai cay DOM. Giam
 * chuyen dong thi doi ngay, khong co lop song nao. Focus o yen tren o cua so, vung aria-live bao troi dang xem, bam
 * trong luc song dang lan bi bo qua. Trang thai doi cho chi o trinh duyet, khong luu, khong tu xoay vong.
 *
 * Chi mot nguoi co tam trang thi khong co o cua so; neu la cua chinh nguoi xem thi troi lon mang nhan "Ban". Hai cau tho
 * khong co ten nguoi; ten nguoi va kieu troi chi doc cho trinh doc man hinh. "Xem lich hoa" chi o troi cua nguoi kia
 * (quyet dinh cua chu du an): ban mau dat loi vao nay sau mot bien dieu kien, va o che do o cua so bat no cho ca hai mat.
 */
export function BauTroi({ tenKia, kia, minh }: { tenKia: string; kia: TroiHien | null; minh: TroiHien | null }) {
  const dai = useRef<HTMLDivElement>(null);
  const caHai = kia !== null && minh !== null;

  // Phu thuoc caHai chu khong phai mang rong: dai co o cua so chi ton tai khi ca hai cung giu tam trang, va so nguoi
  // dang giu tam trang doi ngay trong lan song lai (sau khi tha hay thu lai) ma thanh phan khong bi dung lai. Gan mot
  // lan duy nhat luc vao cay thi di tu mot troi sang hai troi se de nut o cua so khong co tay nghe nao, bam khong an.
  useEffect(() => {
    const w = dai.current;
    return w === null || !caHai ? undefined : ganSong(w);
  }, [caHai]);

  if (kia === null && minh === null) return null;
  const matKia: Mat | null = kia === null ? null : {
    ten: "kia", troi: kia, cuaSo: minh, ai: tenKia, aiCuaSo: "bạn", laMinh: false, bao: `Đang xem trời của ${tenKia}.`,
  };
  const matMinh: Mat | null = minh === null ? null : {
    ten: "minh", troi: minh, cuaSo: kia, ai: "bạn", aiCuaSo: tenKia, laMinh: true, bao: "Đang xem trời của bạn.",
  };
  if (matKia === null || matMinh === null) {
    const mot = (matKia ?? matMinh) as Mat;
    return <MotTroi m={{ ...mot, cuaSo: null }} an={false} />;
  }
  return (
    <div className="troi-cua-so" ref={dai}>
      <MotTroi m={matKia} an={false} />
      <MotTroi m={matMinh} an />
      <p className="sr-only troi-cua-so__bao" aria-live="polite" />
    </div>
  );
}

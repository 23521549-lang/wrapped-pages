"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTamDung } from "@/components/hieu-ung/tam-dung";
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
function MotTroi({ m, an, goc, dung, doiDung, bao }: {
  m: Mat;
  an: boolean;
  /** Chi dat cho bau troi don: dai hai troi tu giu moc rieng cua no (xem BauTroi). */
  goc?: (el: HTMLElement | null) => void;
  dung: boolean;
  doiDung: () => void;
  /** Chi dat cho bau troi don: vung bao cua nut tam dung, phai nam trong dai troi (xem BauTroi). */
  bao?: string;
}) {
  const t = TROI[m.troi.weather];
  return (
    <section
      ref={goc}
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
            <Link className="btn btn--chu" href="/tam-trang"><Hoa weather={m.troi.weather} />Xem lịch hoa</Link>
            {/* Nhan doi theo viec sap lam, khong dung aria-pressed: mot nut mot viec, doc len la biet bam se duoc gi.
                Nut nay dung MOI hieu ung tu chay cua trang, khong rieng bau troi (phan quyet B4). */}
            <button type="button" className="btn btn--chu nut-dung" onClick={doiDung}>
              {dung ? "Cho hiệu ứng chạy" : "Tạm dừng hiệu ứng"}
            </button>
          </p>
          {bao !== undefined && <p className="sr-only" aria-live="polite">{bao}</p>}
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
 * khong co ten nguoi; ten nguoi va kieu troi chi doc cho trinh doc man hinh.
 *
 * "Xem lich hoa" hien o CA HAI mat, ke ca troi cua chinh nguoi xem (yeu cau dot ba diem 3, spec muc 5): lich hoa la
 * cua ca hai nguoi nen khong co ly do doi chu hay giau di. Nhan luon la "Xem lich hoa", bong hoa ep mang mau muc cua
 * kieu troi dang hien. Nho vay hang cuoi (.troi__cuoi) cua hai mat cao bang nhau.
 *
 * Nut "Tam dung hieu ung" nam trong hang cuoi da co san (.troi__cuoi), nen no khong xo dich gi cua ban mau da duyet.
 * Chuyen dong nen cua bau troi tu bat dau, keo dai qua 5 giay va o song song voi noi dung khac - dung ba dieu kien cua
 * WCAG SC 2.2.2, ma ngoai le "essential" khong dung duoc o day (chinh nhanh giam chuyen dong chung minh: bau troi dung
 * yen van dep va van du nghia). Nut bat lop `troi-dung` tren dai troi, lop do dung MOI net ve cua ca hai mat. Lua chon
 * duoc luu va doc lai qua useTamDung (src/components/hieu-ung/tam-dung.ts), dung chung voi bia tu doi cua khung sach
 * lon o plan sau: mot cong tac cho moi hieu ung tu chay, theo phan quyet B4. Khi nguoi dung xin giam chuyen dong thi
 * khong con gi chay, nen nut duoc giau han bang CSS (tam-trang.css, nhanh prefers-reduced-motion).
 */
export function BauTroi({ tenKia, kia, minh }: { tenKia: string; kia: TroiHien | null; minh: TroiHien | null }) {
  const dai = useRef<HTMLElement | null>(null);
  const dangDung = useRef(false);
  const [bao, setBao] = useState("");
  const caHai = kia !== null && minh !== null;
  const batDai = useCallback((el: HTMLElement | null) => {
    dai.current = el;
  }, []);

  /*
   * Duong DUY NHAT dat lop `troi-dung` len dai troi, va no dat bang classList chu khong qua className cua JSX: song.ts
   * cung sua lop cua CHINH phan tu nay (troi-cua-so--san, troi--an), ma React ghi de ca thuoc tinh class moi lan gia
   * tri className doi - tuc mot lan bam tam dung se xoa mat lop do song.ts vua dat.
   *
   * Ham nay chay dong bo trong chinh layout effect cua useTamDung, tuc truoc khi trinh duyet ve khung hinh dau: lop
   * moi la thu quyet dinh bau troi co chay hay khong, con nhan cua nut chi doi theo o vong ve lai sau do.
   */
  const apDung = useCallback((v: boolean) => {
    dangDung.current = v;
    dai.current?.classList.toggle("troi-dung", v);
  }, []);
  const [dung, datDung] = useTamDung(apDung);

  // Phu thuoc caHai chu khong phai mang rong: dai co o cua so chi ton tai khi ca hai cung giu tam trang, va so nguoi
  // dang giu tam trang doi ngay trong lan song lai (sau khi tha hay thu lai) ma thanh phan khong bi dung lai. Gan mot
  // lan duy nhat luc vao cay thi di tu mot troi sang hai troi se de nut o cua so khong co tay nghe nao, bam khong an.
  useEffect(() => {
    const w = dai.current;
    return w === null || !caHai ? undefined : ganSong(w);
  }, [caHai]);

  // Tu mot bau troi sang hai bau troi (hay nguoc lai) thi the boc dai troi la mot phan tu MOI, chua mang lop nao: dat
  // lai lop theo lua chon dang giu, neu khong nguoi da tam dung se thay hieu ung chay lai ma ho khong bam gi. Doc ref
  // chu khong doc `dung`: o lan commit dau tien, useTamDung da dat lop tu localStorage nhung `dung` van con la false.
  useLayoutEffect(() => {
    apDung(dangDung.current);
  }, [apDung, caHai]);

  function doiDung() {
    const moi = !dung;
    datDung(moi);
    setBao(moi ? "Hiệu ứng đã tạm dừng." : "Hiệu ứng chạy lại rồi.");
  }

  if (kia === null && minh === null) return null;
  const matKia: Mat | null = kia === null ? null : {
    ten: "kia", troi: kia, cuaSo: minh, ai: tenKia, aiCuaSo: "bạn", laMinh: false, bao: `Đang xem trời của ${tenKia}.`,
  };
  const matMinh: Mat | null = minh === null ? null : {
    ten: "minh", troi: minh, cuaSo: kia, ai: "bạn", aiCuaSo: tenKia, laMinh: true, bao: "Đang xem trời của bạn.",
  };
  // Vung bao cua nut tam dung nam BEN TRONG dai troi, khong phai mot the anh em: ca hai quy tac khoang cach dau ke sach
  // (".troi + .shell .ke-dau" va ".troi-cua-so + .shell .ke-dau") doi dai troi la anh em LIEN KE ngay truoc .shell, chen
  // bat ky the nao vao giua la khoang cach dau ke sach bat ngo gian ra.
  if (matKia === null || matMinh === null) {
    const mot = (matKia ?? matMinh) as Mat;
    return <MotTroi m={{ ...mot, cuaSo: null }} an={false} goc={batDai} dung={dung} doiDung={doiDung} bao={bao} />;
  }
  return (
    <div className="troi-cua-so" ref={batDai}>
      <MotTroi m={matKia} an={false} dung={dung} doiDung={doiDung} />
      <MotTroi m={matMinh} an dung={dung} doiDung={doiDung} />
      <p className="sr-only troi-cua-so__bao" aria-live="polite" />
      {/* Bao rieng cho nut tam dung, khong dung chung voi .troi-cua-so__bao: o bao ay do song.ts dat textContent thang
          tren DOM, de React quan ly noi dung cua no la hai ben ghi de nhau. */}
      <p className="sr-only" aria-live="polite">{bao}</p>
    </div>
  );
}

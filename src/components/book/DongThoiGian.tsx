"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

/** Mot moc cua dong thoi gian: mot luot dang, hay o mo dau luc tao sach. */
export type MocDong = {
  key: string;
  /** Ngay dang (dam) va ten luot ("Tạo sách", "Lượt 3"). */
  ngay: string;
  luot: string;
  /** Nut tron tren soi doc: dac khi luot co dat rieng, rong khi giu cua luot truoc. */
  nut: ReactNode;
  /** Noi dung cua moc (bia nho, ten bia, ten bai...). */
  noi: ReactNode;
  /** Doan soi tu moc nay toi moc sau la im (dong Nhac nen): ve soi cham thay soi lien. */
  im?: boolean;
};

export type DongThoiGianProps = {
  /** Tien to id, duy nhat trong trang ("bia", "nhac"). */
  ma: string;
  /** Nhan cua truong, nhu nhan cac truong cua trang Sach moi ("Bìa", "Nhạc nền"). */
  nhan: string;
  /** Dong goi y duoi khung khi chua luu gi. */
  goi: string;
  /** Dong tom tat luon hien, bam de mo ca dong thoi gian. */
  tom: ReactNode;
  moc: readonly MocDong[];
  /** Noi dung rũ xuống duoi moc i. thu() cuon bang chon len (goi sau khi luu xong). */
  renderRot: (i: number, thu: () => void) => ReactNode;
  /** Dong bao sau khi luu, kem nut Hoan tac; null khi chua luu gi. */
  bao: ReactNode;
  /** Bang chon dang ban (dang cat hay tai anh): Esc khong thu bang lai giua chung. */
  ban?: boolean;
};

/** Nhip thu bang chon: bang --dur-tha-dong (tokens.css); het nhip moi go noi dung cua bang vua thu. */
const THU_MS = 260;

function Mui() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5.5 8l4.5 4.5L14.5 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Khung dong thoi gian cua man Sua sach (chu du an duyet 28/09): mot o vien nhu o nhap, dong tom tat luon hien, bam thi
 * ca dong thoi gian mo xuong; bam mot moc thi bang chon rũ xuống ngay duoi moc do, mot luc chi mot moc. Mo, thu va rũ
 * deu la chieu cao chay tu 0 toi vua noi dung (luoi 0fr -> 1fr, app.css), cung nhip voi hop Tha tam trang; phan dang
 * dong mang inert. Esc thu bang chon va tra focus ve moc.
 */
export function DongThoiGian({ ma, nhan, goi, tom, moc, renderRot, bao, ban = false }: DongThoiGianProps) {
  const [mo, setMo] = useState(false);
  const [dangRot, setDangRot] = useState<number | null>(null);
  // Bang vua thu van giu noi dung toi het nhip, de chieu cao con thu nho dan chu khong sap mat ngay.
  const [dangThu, setDangThu] = useState<number | null>(null);
  const khungRef = useRef<HTMLFieldSetElement>(null);
  const henRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(henRef.current), []);

  // Esc thu bang chon dang rũ, tu bat ky dieu khien nao ben trong dong thoi gian nay. Nghe o document (nhu trinh xem bia
  // truoc day) vi fieldset khong phai phan tu tuong tac de gan phim.
  const khiPhim = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || dangRot === null || ban) return;
    if (!(e.target instanceof Node) || !khungRef.current?.contains(e.target)) return;
    e.preventDefault();
    thu(dangRot, true);
  });
  useEffect(() => {
    if (dangRot === null) return;
    const nghe = (e: KeyboardEvent) => khiPhim(e);
    document.addEventListener("keydown", nghe);
    return () => document.removeEventListener("keydown", nghe);
  }, [dangRot]);

  function thu(i: number | null = dangRot, traFocus = false) {
    if (i === null) return;
    setDangRot((r) => (r === i ? null : r));
    setDangThu(i);
    clearTimeout(henRef.current);
    henRef.current = setTimeout(() => setDangThu((t) => (t === i ? null : t)), THU_MS);
    if (traFocus) document.getElementById(`${ma}-moc-${i}`)?.focus();
  }

  function bamMoc(i: number) {
    if (dangRot === i) thu(i);
    else {
      if (dangRot !== null) thu(dangRot);
      setDangRot(i);
    }
  }

  function bamTom() {
    if (mo && dangRot !== null) thu(dangRot);
    setMo(!mo);
  }

  return (
    <fieldset className="chon tg" ref={khungRef}>
      <legend id={`${ma}-nhan`}>{nhan}</legend>
      <div className={mo ? "tg__khung tg--mo" : "tg__khung"}>
        <button
          type="button"
          className="tg__tom"
          aria-expanded={mo}
          aria-controls={`${ma}-mo`}
          aria-labelledby={`${ma}-nhan ${ma}-tom ${ma}-tom-mo`}
          onClick={bamTom}
        >
          <span className="tg__tom-noi" id={`${ma}-tom`}>{tom}</span>
          <span className="tg__tom-mo">
            <span className="tg__tom-chu-mo" id={`${ma}-tom-mo`}>{mo ? "Thu gọn" : "Theo lượt"}</span>
            <Mui />
          </span>
        </button>
        <div className="tg__mo" id={`${ma}-mo`} inert={!mo}>
          <div className="tg__boc">
            <ol className="tg__ds" aria-labelledby={`${ma}-nhan`}>
              {moc.map((m, i) => {
                const rotMo = dangRot === i;
                return (
                  <li key={m.key} className={m.im ? "tg-o tg-o--im" : "tg-o"}>
                    <button
                      type="button"
                      className="tg-dong"
                      id={`${ma}-moc-${i}`}
                      aria-expanded={rotMo}
                      aria-controls={`${ma}-rot-${i}`}
                      onClick={() => bamMoc(i)}
                    >
                      <span className="tg-dong__moc"><b>{m.ngay}</b><span>{m.luot}</span></span>
                      {m.nut}
                      {m.noi}
                      <span className="tg-dong__mui"><Mui /></span>
                    </button>
                    <div className={rotMo ? "tg-rot tg-rot--mo" : "tg-rot"} id={`${ma}-rot-${i}`} inert={!rotMo}>
                      <div className="tg-rot__boc">
                        <div className="tg-rot__in">{(rotMo || dangThu === i) && renderRot(i, () => thu(i, true))}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
      <p className="field__help tg__bao" aria-live="polite">{bao ?? goi}</p>
    </fieldset>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CoverKey } from "@/lib/book";
import { soCot, soCuonCuaTang } from "@/lib/luoi-cot";
import { ShelfBook } from "./ShelfBook";

/** Thu gon con chung nay tang moi ngan (diem 14 cua chu du an, phan quyet B6: tinh theo TUNG ngan). */
export const SO_TANG_GON = 3;

/**
 * DUNG NHUNG TRUONG ma mot the sach tren ke ve ra, khong hon mot truong nao.
 *
 * Day la mot thanh phan TRINH DUYET, nen moi truong cua props di qua day deu duoc chep nguyen van vao goi du lieu ma
 * may chu gui xuong. Truyen ca dong ShelfBook vao day la gui kem ca `excerpt` - doan trich cua cuon - ma doan trich
 * cua mot luot con niem phong thi khong bao gio duoc xuong trinh duyet, ke ca duoi dang khong ve ra. Vi vay kieu nay
 * liet ke tung truong mot, va `isPrivate` da tinh san o may chu de ca `mode` cung khong phai di theo.
 *
 * `when` cung phai tinh o may chu: no la thoi gian TUONG DOI ("hôm qua", "2 giờ trước"), ma may chu voi trinh duyet
 * doc dong ho khac nhau thi lan ve dau cua trinh duyet se lech voi HTML may chu gui xuong.
 */
export type SachTrenKe = {
  id: string;
  title: string;
  cover: CoverKey;
  coverMediaId: string | null;
  pageCount: number;
  newCount: number;
  lockedCount: number;
  isPrivate: boolean;
  when: string;
};

export type NganProps = {
  ten: string;
  books: readonly SachTrenKe[];
  /** Chu cua ngan trong. */
  trong: string;
};

/**
 * Mot ngan ke: tieu de, so cuon, cac hang sach. Moi hang dung tren mot mep ke, nen mot hang doc ra la mot tang.
 *
 * Thu gon con ba tang. Sach bi gon KHONG duoc ve ra cay: ve roi cat bang overflow thi phim Tab van di vao chung va
 * vong focus roi vao cho khong nhin thay. Vi vay so cot phai biet that, ma so cot la su that cua trinh duyet
 * (repeat auto-fill theo be rong va theo co chu), nen phai doc tu tri da tinh.
 *
 * Truoc khi trinh duyet chay xong, may chu da ve CA ngan va boc trong mot khoi cat bang CSS (`.ngan__gon`), nen nguoi
 * khong co JavaScript van thay dung ba tang va khong thay mot nut vo dung nao. Ngay khi gan, mot layout effect (chay
 * truoc khi ve, nen khong nhay va khong xo dich) doc so cot, cat danh sach va bo lop cat do.
 */
export function Ngan({ ten, books, trong }: NganProps) {
  const luoiRef = useRef<HTMLUListElement>(null);
  /** null la chua do xong: may chu con dang cat bang CSS. */
  const [cot, setCot] = useState<number | null>(null);
  const [mo, setMo] = useState(false);

  const doCot = useCallback(() => {
    const luoi = luoiRef.current;
    if (!luoi) return;
    setCot(soCot(globalThis.getComputedStyle(luoi).gridTemplateColumns));
  }, []);

  // Do lan dau trong layout effect: xong truoc khi trinh duyet ve, nen khong ai thay ngan dai ra roi ngan lai.
  useLayoutEffect(doCot, [doCot]);

  // Do lai khi be rong hay co chu doi. Gom nhip bang mot khung hinh: ResizeObserver co the ban lien tuc trong luc keo
  // cua so, ma phep do nay doc bo cuc.
  useEffect(() => {
    const luoi = luoiRef.current;
    if (!luoi || typeof ResizeObserver === "undefined") return;
    let khung = 0;
    const theo = new ResizeObserver(() => {
      cancelAnimationFrame(khung);
      khung = requestAnimationFrame(doCot);
    });
    theo.observe(luoi);
    return () => {
      cancelAnimationFrame(khung);
      theo.disconnect();
    };
  }, [doCot]);

  const gonDuoc = cot !== null && books.length > soCuonCuaTang(cot, SO_TANG_GON);
  const hien = gonDuoc && !mo ? books.slice(0, soCuonCuaTang(cot, SO_TANG_GON)) : books;
  const conLai = books.length - hien.length;

  return (
    <section className="ngan" aria-label={ten}>
      <div className="ngan__dau">
        <h2 className="d">{ten}</h2>
        <span className="ngan__dem">{books.length} cuốn</span>
      </div>
      {books.length === 0 ? (
        <div className="ngan__trong">
          <p>{trong}</p>
          <span className="ke-mep" aria-hidden="true" />
        </div>
      ) : (
        <>
          {/* Chua do xong thi may chu cat bang CSS; do xong roi thi danh sach da cat that, khong can cat nua. */}
          <div className={cot === null ? "ngan__gon" : undefined}>
            <ul className="hang" ref={luoiRef}>
              {hien.map((b) => (
                <ShelfBook
                  key={b.id}
                  title={b.title}
                  href={`/sach/${b.id}`}
                  cover={b.cover}
                  coverMediaId={b.coverMediaId}
                  pageCount={b.pageCount}
                  when={b.when}
                  newCount={b.newCount}
                  lockedCount={b.lockedCount}
                  isPrivate={b.isPrivate}
                />
              ))}
            </ul>
          </div>
          {gonDuoc && (
            <button
              type="button"
              className={mo ? "ke-nut" : "ke-nut ke-nut--gon"}
              aria-expanded={mo}
              onClick={() => setMo((v) => !v)}
            >
              <span className="ke-nut__chu" aria-hidden="true">{mo ? "Thu gọn" : "Mở rộng"}</span>
              <span className="sr-only">{mo ? `Thu gọn ${ten.toLowerCase()}` : `Mở rộng ${ten.toLowerCase()}, còn ${conLai} cuốn`}</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

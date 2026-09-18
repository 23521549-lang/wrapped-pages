import Link from "next/link";
import type { CoverKey } from "@/lib/book";
import { CoverArt } from "./CoverArt";
import { CoverImage } from "./CoverImage";

/** Ky hieu o khoa nho cua dau hieu "trang khóa". Chi ve, chu di kem noi nghia. */
export function GlyphKhoa() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="2.2" y="5.2" width="7.6" height="5.4" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5.2V3.9a2 2 0 0 1 4 0v1.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Ky hieu mat gach cheo cua dau hieu "Riêng tư". Chi ve, chu di kem noi nghia. */
export function GlyphRieng() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M1.2 6s1.8-3.3 4.8-3.3S10.8 6 10.8 6 9 9.3 6 9.3 1.2 6 1.2 6Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 10 10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export type ShelfBookProps = {
  title: string;
  href: string;
  cover: CoverKey;
  /** Bia tu tai len: anh phu len tranh ve cover; anh hong thi tranh ve lo ra. */
  coverMediaId: string | null;
  pageCount: number;
  /** Thoi diem da doi ra chu (vd "2 giờ trước"). */
  when: string;
  newCount: number;
  /** So to dang khoa voi nguoi xem (listShelf da tinh theo nguoi xem). */
  lockedCount: number;
  /** Sach rieng tu cua chinh nguoi xem (sach rieng tu cua nguoi kia khong bao gio toi day). */
  isPrivate: boolean;
};

/**
 * Mot cuon dung tren ke: bia 5:3 co gay, mep ke chay het hang, ten, dong phu va dau hieu trang thai bang chu kem
 * ky hieu nho (khong nen, khong vien). Ca cuon la mot lien ket, nen vung bam va vong focus bao tron cuon sach.
 * Vi tuong tac duy nhat: re chuot hay focus thi cuon sach nhich ra khoi ke (chi transform, co nhanh giam chuyen dong).
 */
export function ShelfBook({ title, href, cover, coverMediaId, pageCount, when, newCount, lockedCount, isPrivate }: ShelfBookProps) {
  const coDauHieu = newCount > 0 || lockedCount > 0 || isPrivate;
  return (
    <li className="cuon">
      <Link className="cuon__lien" href={href}>
        <span className={`cuon__bia bia--${cover}`}>
          <CoverArt cover={cover} />
          <CoverImage mediaId={coverMediaId} />
        </span>
        <span className="cuon__chu">
          <span className="cuon__ten d">{title}</span>
          <span className="cuon__phu">{pageCount > 0 ? `${pageCount} trang, ${when}` : `Chưa có trang, ${when}`}</span>
          {coDauHieu && (
            <span className="dau-hieu">
              {newCount > 0 && <span className="dh dh--moi"><span className="cham" aria-hidden="true" />{newCount} trang mới</span>}
              {lockedCount > 0 && <span className="dh dh--khoa"><GlyphKhoa />{lockedCount} trang khóa</span>}
              {isPrivate && <span className="dh dh--rieng"><GlyphRieng />Riêng tư</span>}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

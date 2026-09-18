import Link from "next/link";
import type { CoverKey } from "@/lib/book";
import { initialOf } from "@/lib/initial";
import { CoverArt } from "./CoverArt";
import { CoverImage } from "./CoverImage";

export type BookCardProps = {
  title: string;
  cover: CoverKey;
  /** Bia tu tai len: anh phu len tranh ve cover; anh hong thi tranh ve lo ra. */
  coverMediaId?: string | null;
  /** Biet danh chu sach; chu cai dau nam trong o tron tren bia. */
  owner: string;
  /** Dong phu: biet danh chu sach kem thoi diem. */
  meta: string;
  /** Duong toi man doc. Khong co thi ten sach khong phai lien ket (o xem truoc cua form). */
  href?: string;
  excerpt?: string;
  pageCount?: number;
  newCount?: number;
  /** So to dang khoa voi nguoi xem (listShelf da tinh theo nguoi xem). */
  lockedCount?: number;
  /** Sach rieng tu cua chinh nguoi xem (sach rieng tu cua nguoi kia khong bao gio toi day). */
  isPrivate?: boolean;
};

/**
 * The sach, dung chung cho ke sach va o xem truoc cua form. Lien ket o ten sach phu kin
 * ca the (.book__t a::after), nen bam dau tren the cung mo sach.
 */
export function BookCard({ title, cover, coverMediaId, owner, meta, href, excerpt, pageCount, newCount = 0, lockedCount = 0, isPrivate = false }: BookCardProps) {
  return (
    <article className="book">
      <div className={`book__cover bia--${cover}`}>
        <CoverArt cover={cover} />
        <CoverImage mediaId={coverMediaId} />
        <span className="av book__owner" aria-hidden="true">{initialOf(owner)}</span>
      </div>
      <p className="book__t d">
        {newCount > 0 && <span className="new" aria-hidden="true" />}
        {href ? <Link className="book__ten" href={href}>{title}</Link> : <span className="book__ten">{title}</span>}
      </p>
      <p className="book__m">{meta}</p>
      {excerpt !== undefined && <p className="book__x">{excerpt}</p>}
      <div className="book__f">
        {pageCount !== undefined && <span className="chip">{pageCount} trang</span>}
        {newCount > 0 && <span className="chip chip--key">{newCount} trang mới</span>}
        {lockedCount > 0 && <span className="chip">{lockedCount} trang khóa</span>}
        {isPrivate && <span className="chip">Riêng tư</span>}
      </div>
    </article>
  );
}

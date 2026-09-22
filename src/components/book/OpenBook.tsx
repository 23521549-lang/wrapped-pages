import Link from "next/link";
import type { CoverKey } from "@/lib/book";
import { LockedBars } from "@/components/reader/LockedSheet";
import { CoverArt } from "./CoverArt";
import { CoverImage } from "./CoverImage";
import { GlyphKhoa, GlyphRieng } from "./ShelfBook";

export type OpenBookProps = {
  /** "Bạn" khi la cuon cua nguoi xem, con lai la biet danh chu sach. */
  who: string;
  title: string;
  cover: CoverKey;
  coverMediaId: string | null;
  pageCount: number;
  /**
   * To man doc mo khi bam khung: to co chu chon cho hom nay, khong co thi to doc duoc dau tien co chu; khong to doc duoc
   * nao co chu thi to doc duoc dau tien (moi to deu khoa thi to cuoi). In o chan trang phai nhu so trang khi khong locked.
   */
  position: number;
  /** Man doc mo dung to position: ca khung sach la mot lien ket toi day. */
  readHref: string;
  when: string;
  /** Chu cua to position; khi locked thi chi la dong he lo (hoac null), khong bao gio la chu that. */
  excerpt: string | null;
  /**
   * Khong to doc duoc nao co chu va to cuoi nam trong niem phong con khoa voi nguoi xem: excerpt la dong he lo cua niem
   * phong do, khong phai chu cua to position (to position co the chi co anh). Vi vay khi locked khong in so trang duoi
   * dong he lo, va nhan lien ket noi "tu trang N" (noi man doc bat dau) thay vi "tai trang N".
   */
  locked: boolean;
  /** Cuon rieng tu cua chinh nguoi xem. */
  isPrivate: boolean;
  action: { label: string; href: string };
};

/**
 * Trang phai cua cuon sach mo. Khoa: chi dong he lo (neu co) va vach nhoe trang tri, chu that khong co trong DOM.
 * Rieng tu: chu cua chinh nguoi xem, lam mo cho nguoi sau lung khong doc duoc, an voi trinh doc man hinh.
 */
function TrangPhai({ excerpt, locked, isPrivate }: Pick<OpenBookProps, "excerpt" | "locked" | "isPrivate">) {
  if (locked) {
    return (
      <div className="trang-khoa">
        {excerpt && <p className="he-lo">{excerpt}</p>}
        <LockedBars />
        <p className="trang-che trang-che--duoi"><GlyphKhoa /><span><b>Trang khóa</b>, vượt thử thách để đọc</span></p>
      </div>
    );
  }
  if (isPrivate) {
    return (
      <>
        {excerpt && <p className="vua-viet__chu vua-viet__chu--mo" aria-hidden="true">{excerpt}</p>}
        <p className="trang-che trang-che--giua"><GlyphRieng /><span><b>Riêng tư</b><br />Mở sách để đọc</span></p>
      </>
    );
  }
  return excerpt ? <p className="vua-viet__chu">{excerpt}</p> : null;
}

/**
 * "X vua viet": mot cuon sach mo nho cung chat lieu to giay man doc. Trang trai: ai viet, ten sach, bia that cua
 * cuon nay dan nhu tranh in (nghieng nhe, re chuot hay focus thi dat thang) va mot nut chinh duy nhat o chan trang.
 * Trang phai: doan trich cua to position va so trang o chan. Man hep chi con mot to: doan trich truoc, thong tin sau.
 * Ca khung la mot lien ket toi man doc o dung to cua doan trich (lop phu dau DOM, nut chinh nam tren no va ngoai no),
 * nen khong co lien ket long nhau.
 */
export function OpenBook({ who, title, cover, coverMediaId, pageCount, position, readHref, when, excerpt, locked, isPrivate, action }: OpenBookProps) {
  return (
    <article className="vua-viet" aria-label="Một trang trong sách">
      <div className="sach-mo">
        <Link className="sach-mo__lien" href={readHref}>
          <span className="sr-only">{`Đọc ${title} ${locked ? "từ" : "tại"} trang ${position}`}</span>
        </Link>
        <div className="sach-mo__to sach-mo__to--trai">
          <div>
            <p className="vua-viet__ai"><b>{who}</b> vừa viết</p>
            <h2 className="vua-viet__ten d">{title}</h2>
            <p className="vua-viet__phu">{pageCount} trang, {when}</p>
          </div>
          <div className="tranh-dan">
            <div className="tranh-dan__to">
              <div className={`tranh-dan__bia bia--${cover}`}>
                <CoverArt cover={cover} />
                <CoverImage mediaId={coverMediaId} />
              </div>
            </div>
          </div>
          <Link className="btn sach-mo__nut" href={action.href}>{action.label}</Link>
        </div>
        <div className="sach-mo__to sach-mo__to--phai">
          <TrangPhai excerpt={excerpt} locked={locked} isPrivate={isPrivate} />
          {!locked && <span className="sach-mo__so" aria-hidden="true">{position}</span>}
        </div>
      </div>
    </article>
  );
}

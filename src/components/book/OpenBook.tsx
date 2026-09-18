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
  /** Vi tri to cuoi, in o chan trang phai nhu so trang. */
  lastPosition: number;
  when: string;
  /** Doan trich cua to cuoi; khi to cuoi dang khoa thi day chi la dong he lo (hoac null), khong bao gio la chu that. */
  excerpt: string | null;
  /** To cuoi dang khoa voi nguoi xem. */
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
 * Trang phai: doan trich cua to cuoi va so trang o chan. Man hep chi con mot to: doan trich truoc, thong tin sau.
 */
export function OpenBook({ who, title, cover, coverMediaId, pageCount, lastPosition, when, excerpt, locked, isPrivate, action }: OpenBookProps) {
  return (
    <article className="vua-viet" aria-label="Trang gần nhất">
      <div className="sach-mo">
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
          <span className="sach-mo__so" aria-hidden="true">{lastPosition}</span>
        </div>
      </div>
    </article>
  );
}

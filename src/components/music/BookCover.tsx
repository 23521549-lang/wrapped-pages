import type { CoverKey } from "@/lib/book";
import { initialOf } from "@/lib/initial";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";

/**
 * Tam bia cua moi cuon truoc cu bam "Mở sách" (co nhac hay khong): tranh bia (bia tu tai len phu len tranh), chu sach va
 * ten sach. Khong so trang, khong so trang khoa, khong dong he lo: nhung thu do thuoc dau man doc, hien sau khi mo.
 */
export function BookCover({ title, cover, coverMediaId, owner }: { title: string; cover: CoverKey; coverMediaId?: string | null; owner: string }) {
  return (
    <>
      <div className={`bia bia-mo__hinh bia--${cover}`}>
        <CoverArt cover={cover} />
        <CoverImage mediaId={coverMediaId} />
      </div>
      <p className="meta bia-mo__ai">
        <span className="av" aria-hidden="true">{initialOf(owner)}</span>
        {owner} viết
      </p>
      <h1 className="d bia-mo__t">{title}</h1>
    </>
  );
}

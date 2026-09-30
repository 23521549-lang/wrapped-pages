import { CAM_XUC, CHIP, type LoaiCamXuc } from "@/lib/cam-xuc";

/**
 * Anh mot linh vat (loai null la Chip): WebP dong o che do thuong, khung dau tinh khi nguoi dung xin giam chuyen dong,
 * chon bang the picture nen khong can JS. tinh = true thi luon la khung tinh (Chip dang ngu).
 */
export function AnhLinhVat({ loai, className, tinh = false }: { loai: LoaiCamXuc | null; className: string; tinh?: boolean }) {
  const lv = loai === null ? CHIP : CAM_XUC[loai];
  return (
    <picture className={className}>
      <source srcSet={lv.anhTinh} media="(prefers-reduced-motion: reduce)" />
      {/* oxlint-disable-next-line nextjs/no-img-element -- WebP dong tu public/, da thu nho san; next/image toi uu lai se mat chuyen dong. */}
      <img src={tinh ? lv.anhTinh : lv.anh} alt="" width={176} height={176} decoding="async" />
    </picture>
  );
}

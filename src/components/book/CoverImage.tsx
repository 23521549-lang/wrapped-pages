"use client";

import { useEffect, useRef } from "react";
import { mediaSrc } from "@/lib/media/node";

/**
 * Anh bia tu tai len, dat ngay sau CoverArt trong cung khung bia. img phu kin tranh ve (.bia__anh): luc anh dang
 * tai thi tranh ve hien san; anh hong (kho tat tra 503, media da bi don, mat mang) thi img an va tranh ve lo ra, khung
 * giu nguyen kich thuoc nen khong nhay bo cuc, khong co o trong. alt rong vi ten sach luon nam ngay canh bia. Anh chi
 * toi qua /m, noi canViewMedia quyet quyen. key theo id: doi bia thi la img moi, khong mang trang thai an cua anh cu.
 */
export function CoverImage({ mediaId }: { mediaId: string | null | undefined }) {
  return mediaId ? <CoverImg key={mediaId} src={mediaSrc(mediaId)} /> : null;
}

/**
 * An img khi anh hong. Anh trong HTML may chu co the hong truoc khi React gan onError, nen luc gan con kiem lai: da xong
 * (complete) ma khong co diem anh nao la anh hong. Thuoc tinh hidden khong do React quan ly, nen an thang tren DOM.
 */
function CoverImg({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) img.hidden = true;
  }, []);
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- /m kiem phien cua nguoi xem o moi lan tai. Bo toi uu anh cua Next tai anh tu may chu khong kem phien va giu ban sao trong bo nho dem chung, nen bia rieng tu phai la img thang.
    <img
      ref={ref}
      className="bia__anh"
      src={src}
      alt=""
      decoding="async"
      onError={(e) => {
        e.currentTarget.hidden = true;
      }}
    />
  );
}

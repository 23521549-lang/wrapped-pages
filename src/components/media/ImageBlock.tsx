"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { imageBox } from "@/lib/media/layout";
import { mediaSrc } from "@/lib/media/node";
import { IconAnh } from "./icons";

export type ImageBlockProps = {
  id: string;
  w: number;
  h: number;
  /** Ten nguoi dang, cho chu thay the "Anh {ten} dang". */
  author: string;
  /** Nghi thuc mo chua go toi khoi nay (DocView typing): giu cho nhung an ca khoi. */
  pending?: boolean;
  /** Ve them trong khoi, vd nut Bo anh cua man viet. */
  children?: ReactNode;
};

/**
 * Khoi anh trong vung chu: hop co dung imageBox(w, h) qua thuoc tinh width va height, nen hinh hoc co ngay tu attrs,
 * truoc khi anh ve toi. Anh chi doc qua route /m. Anh khong tai duoc (mang, kho tat, tep hong) thi thanh cho trong
 * yen lang cung dung kich thuoc, nen doan chu phia duoi va cho ngat trang khong doi.
 */
export function ImageBlock({ id, w, h, author, pending = false, children }: ImageBlockProps) {
  const { width, height } = imageBox({ w, h });
  const cho = pending ? " chua-go-khoi" : "";
  const [hong, setHong] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    // Anh hong truoc luc hydrate thi React khong nghe duoc su kien error: doc thang trang thai cua the img sau khi gan.
    // oxlint-disable-next-line react/set-state-in-effect -- dong bo voi he thong ngoai (trang thai tai cua the img trong DOM), khong the biet luc render.
    if (img && img.complete && img.naturalWidth === 0) setHong(true);
  }, []);

  if (hong) {
    return (
      <figure className={`khoi-anh khoi-anh--loi${cho}`} aria-label={`Ảnh ${author} đăng, chưa tải được.`}>
        <svg className="khoi-anh__cho" width={width} height={height} aria-hidden="true" focusable="false" />
        <div className="khoi-anh__loi" aria-hidden="true">
          <IconAnh />
          <span>Chưa tải được ảnh.</span>
        </div>
        {children}
      </figure>
    );
  }
  return (
    <figure className={`khoi-anh${cho}`}>
      {/* oxlint-disable-next-line nextjs/no-img-element -- anh rieng tu doc qua route /m co kiem quyen tung lan; next/image toi uu qua may chu anh cua Next, khong mang cookie phien va ton han muc. */}
      <img
        ref={ref}
        className="khoi-anh__anh"
        src={mediaSrc(id)}
        width={width}
        height={height}
        alt={`Ảnh ${author} đăng`}
        loading="lazy"
        decoding="async"
        onError={() => setHong(true)}
      />
      {children}
    </figure>
  );
}

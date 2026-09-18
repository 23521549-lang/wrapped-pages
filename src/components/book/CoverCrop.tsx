"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  COVER_ZOOM, cropRect, dragCrop, initialCrop, keyCrop, zoomCrop, type CropRect, type CropState, type ImageSize,
} from "@/lib/media/crop";

/** Mot lan keo: con tro dang keo, diem bat dau tren man hinh, trang thai luc bat dau va kich thuoc hien cua san. */
type Drag = { pointerId: number; x: number; y: number; start: CropState; box: { width: number; height: number } };

export type CoverCropProps = {
  /** Kich thuoc anh goc da xoay theo EXIF: he toa do cua san cat va cua khung. */
  size: ImageSize;
  /** Blob URL cua anh xem truoc ve tu chinh bitmap se dem cat. */
  previewUrl: string;
  onUse: (rect: CropRect) => void;
  onPickAgain: () => void;
  onCancel: () => void;
};

/**
 * Buoc cat bia 5:3, mo ngay duoi bang bia, khong phai hop thoai. San la mot SVG co viewBox
 * bang kich thuoc anh goc, nen vi tri khung la thuoc tinh x, y, width, height cua rect tinh bang diem anh nguon: khong
 * style noi tuyen, va khung ve ra dung la phan anh dem cat. Keo bang Pointer Events (giu con tro tren san), phim mui ten
 * doi khung, Shift doi xa hon; Thu phong la input range that. Mo ra thi focus vao san. Moi phep tinh o src/lib/media/crop.ts.
 */
export function CoverCrop({ size, previewUrl, onUse, onPickAgain, onCancel }: CoverCropProps) {
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [crop, setCrop] = useState(() => initialCrop(size));
  const rect = cropRect(size, crop);
  // Id cua mask nam trong url(#...): chi giu chu, so, gach duoi va gach ngang tu id cua React.
  const maskId = `mo-${id.replace(/[^A-Za-z0-9_-]/g, "")}`;

  // Focus ngay trong lan commit dua san vao DOM (layout effect), khong de mot nhip ma san da hien nhung focus chua toi.
  useLayoutEffect(() => {
    stageRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = keyCrop(size, crop, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    setCrop(next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const { width, height } = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, start: crop, box: { width, height } };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d?.pointerId !== e.pointerId) return;
    setCrop(dragCrop(size, d.start, d.box, e.clientX - d.x, e.clientY - d.y));
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }

  return (
    <section className="cat-bia" aria-labelledby={`${id}-t`}>
      <h2 className="d cat-bia__t" id={`${id}-t`}>Cắt ảnh bìa</h2>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- San cat la vung keo va nhan phim mui ten: nhom co nhan va mo ta, ban phim doi khung ngay tren nhom. */}
      <div
        ref={stageRef}
        className="cat-bia__san"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Nhom phai vao duoc bang Tab thi phim mui ten moi doi duoc khung.
        tabIndex={0}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- fieldset la nhom o nhap cua form; san cat khong chua o nhap nao va da nam trong fieldset Bia.
        role="group"
        aria-label="Khung cắt ảnh bìa"
        aria-describedby={`${id}-help`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true" focusable="false">
          <image href={previewUrl} width={size.width} height={size.height} preserveAspectRatio="none" />
          <defs>
            <mask id={maskId}>
              <rect width={size.width} height={size.height} fill="white" />
              <rect {...rect} fill="black" />
            </mask>
          </defs>
          <rect className="cat-bia__mo" width={size.width} height={size.height} mask={`url(#${maskId})`} />
          <rect className="cat-bia__khung" {...rect} vectorEffect="non-scaling-stroke" />
          <rect className="cat-bia__vien" {...rect} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="field__help" id={`${id}-help`}>Kéo khung hoặc dùng phím mũi tên để chọn phần làm bìa. Giữ Shift để dời xa hơn.</p>
      <div className="cat-bia__co">
        <label htmlFor={`${id}-zoom`}>Thu phóng</label>
        <input
          className="thanh-truot"
          id={`${id}-zoom`}
          type="range"
          min={COVER_ZOOM.min}
          max={COVER_ZOOM.max}
          step={COVER_ZOOM.step}
          value={crop.zoom}
          onChange={(e) => setCrop(zoomCrop(size, crop, Number(e.target.value)))}
        />
      </div>
      <div className="cat-bia__nut">
        <button className="btn" type="button" onClick={() => onUse(rect)}>Dùng ảnh này</button>
        <button className="btn btn--quiet" type="button" onClick={onPickAgain}>Chọn ảnh khác</button>
        <button className="btn btn--line" type="button" onClick={onCancel}>Hủy</button>
      </div>
    </section>
  );
}

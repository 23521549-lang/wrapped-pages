"use client";

import { useId } from "react";
import { IconAnh, IconX } from "./icons";

/*
 * Dong tai anh (lop .tai-anh, .tien-do), dung chung cho man viet va bia. Chu cua dong khong mang
 * aria-live: dong mount va go ra theo tung luot, nen noi goi doc cau qua mot vung doc luon nam trong DOM.
 */

/** O anh dau dong: anh xem truoc (blob: vua ve tren canvas) hoac bieu tuong anh. */
export function UploadThumb({ preview }: { preview: string | null }) {
  return preview ? (
    <span className="tai-anh__hinh" aria-hidden="true">
      {/* oxlint-disable-next-line nextjs/no-img-element -- anh xem truoc la blob: vua ve tren canvas o trinh duyet, next/image khong doc duoc. */}
      <img src={preview} alt="" />
    </span>
  ) : (
    <span className="tai-anh__hinh tai-anh__hinh--dau" aria-hidden="true"><IconAnh /></span>
  );
}

type ProgressProps = { label: string; cancelLabel: string; preview: string | null; onCancel: () => void };

/** Dang xu ly hay tai anh. Server action khong bao so byte da gui, nen thanh tien do khong xac dinh, khong co so phan tram. */
export function UploadProgress({ label, cancelLabel, preview, onCancel }: ProgressProps) {
  const labelId = useId();
  return (
    <div className="tai-anh">
      <UploadThumb preview={preview} />
      <div className="tai-anh__than">
        <p className="tai-anh__chu"><span id={labelId}>{label}</span></p>
        <progress className="tien-do" aria-labelledby={labelId} />
      </div>
      <button type="button" className="btn btn--quiet btn--sm" aria-label={cancelLabel} onClick={onCancel}>Hủy</button>
    </div>
  );
}

type FailureProps = {
  message: string;
  hint: string | null;
  preview: string | null;
  /** Co thi hien Thu lai (gui lai dung anh da xu ly); null thi hien Chon anh khac. */
  onRetry: (() => void) | null;
  onPick: () => void;
  onClose: () => void;
};

/** Anh khong dung duoc hay tai len hong. Loi dung chu dam voi dau cham than, khong mang mau. */
export function UploadFailure({ message, hint, preview, onRetry, onPick, onClose }: FailureProps) {
  return (
    <div className="tai-anh">
      <UploadThumb preview={preview} />
      <div className="tai-anh__than">
        <p className="tai-anh__chu tai-anh__chu--loi"><span className="dau-loi" aria-hidden="true">!</span>{message}</p>
        {hint && <p className="tai-anh__phu">{hint}</p>}
      </div>
      <div className="tai-anh__nut">
        {onRetry ? (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onRetry}>Thử lại</button>
        ) : (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onPick}>Chọn ảnh khác</button>
        )}
        <button type="button" className="btn btn--quiet btn--sm tai-anh__dong" aria-label="Đóng" onClick={onClose}><IconX /></button>
      </div>
    </div>
  );
}

"use client";

import type { SaveStatus } from "./autosave";

// Mui gio co dinh: may chu va trinh duyet ra cung mot chu, khong lech luc hydrate.
const gio = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

type Props = {
  status: SaveStatus | null;
  /** Canh bao vuot tran ky tu (charCountLabel); co thi chiem cho trang thai luu. */
  warning: string | null;
  onRetry: () => void;
};

/**
 * Trang thai luu nhap. Chu chi doi khi trang thai doi loai, hoac khi ban nhap vua vuot hay vua lui ve duoi tran ky
 * tu, nen vung aria-live khong doc lai o moi phim. Ca hai nhanh ve cung mot the p o cung mot cho, nen React giu
 * nguyen vung aria-live va trinh doc man hinh doc canh bao dung mot lan luc vua vuot.
 */
export function SaveBadge({ status, warning, onRetry }: Props) {
  if (warning !== null) {
    return (
      <p className="luu dem-chu dem-chu--tran" aria-live="polite">
        <span className="dau-loi" aria-hidden="true">!</span>
        {warning}
      </p>
    );
  }
  if (status === null) return null;
  return (
    <p className={status.kind === "loi" ? "luu luu--loi" : "luu"} aria-live="polite">
      {status.kind === "da-luu" && `Đã lưu lúc ${gio.format(new Date(status.at))}`}
      {status.kind === "dang-luu" && "Đang lưu"}
      {status.kind === "chua-luu" && "Chưa lưu"}
      {status.kind === "loi" && (
        <>
          {status.message}
          <button type="button" className="btn btn--line btn--sm" onClick={onRetry}>Thử lại</button>
        </>
      )}
    </p>
  );
}

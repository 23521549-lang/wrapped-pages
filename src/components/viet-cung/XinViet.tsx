"use client";

import { actionRutLai, actionTraLoi, actionXinViet } from "@/app/actions/viet-cung";
import { useHanhDong } from "./hanh-dong";
import { NgoiBut } from "./NgoiBut";
import { XacNhan } from "./XacNhan";

export type XinVietProps = {
  bookId: string;
  /** Biet danh chu cuon (nguoi kia). */
  chu: string;
  /** Chua xin, da xin (dang cho chu cuon), hay chu cuon dang moi minh. */
  trangThai: "khong" | "da-xin" | "duoc-moi";
};

/**
 * Dau man doc cuon chia se mot nguoi viet cua nguoi kia (5c muc C2, C7): "Xin viết cùng" hoi lai mot lan roi gui; da xin
 * thi thanh dong "Đã xin, chờ {tên}" kem "Rút lời xin"; chu cuon dang moi minh thi "Nhận lời" / "Từ chối" ngay tai day.
 */
export function XinViet({ bookId, chu, trangThai }: XinVietProps) {
  const { loi, pending, chay } = useHanhDong();
  if (trangThai === "khong") {
    return (
      <XacNhan
        nut="Xin viết cùng"
        nutClass="btn btn--line"
        truocNut={<NgoiBut />}
        hoi={`Gửi lời xin tới ${chu}?`}
        giai={`${chu} đồng ý thì cuốn sang kệ Hai Ngòi Bút và hai người cùng viết.`}
        dongY="Gửi lời xin"
        chay={() => actionXinViet(bookId)}
      />
    );
  }
  return (
    <div className="xin-viet">
      <p className="xin-viet__chu">
        <NgoiBut />
        {trangThai === "da-xin" ? <span>Đã xin, chờ {chu}</span> : <span><b>{chu} mời bạn viết cùng cuốn này.</b></span>}
      </p>
      <div className="xin-viet__nut">
        {trangThai === "da-xin" ? (
          <button type="button" className="btn btn--line btn--sm" disabled={pending} aria-busy={pending || undefined} onClick={() => chay(() => actionRutLai(bookId))}>
            Rút lời xin
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--sm" disabled={pending} aria-busy={pending || undefined} onClick={() => chay(() => actionTraLoi(bookId, true))}>
              Nhận lời
            </button>
            <button type="button" className="btn btn--line btn--sm" disabled={pending} onClick={() => chay(() => actionTraLoi(bookId, false))}>
              Từ chối
            </button>
          </>
        )}
      </div>
      {loi && <p className="form__loi" role="alert">{loi}</p>}
    </div>
  );
}

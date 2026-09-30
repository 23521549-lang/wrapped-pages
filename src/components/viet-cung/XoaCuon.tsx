"use client";

import { actionDeNghiXoa, actionRutLai, actionTraLoi } from "@/app/actions/viet-cung";
import { useHanhDong } from "./hanh-dong";
import { XacNhan } from "./XacNhan";

export type XoaCuonProps = {
  bookId: string;
  partnerNickname: string;
  /** De nghi xoa dang cho: chua co, do chinh minh gui, hay do nguoi kia gui. */
  deNghi: "khong" | "cua-toi" | "cua-kia";
  /** Id cua tieu de muc, de trinh doc man hinh doc ca muc khi trang thai doi. */
  headingId: string;
};

/**
 * Muc "Xóa cuốn" cuoi Sua sach cua sach viet cung (5c muc D): cuon chi bi xoa khi ca hai dong y. Chua ai de nghi: "Đề nghị
 * xóa". Minh da de nghi: cho nguoi kia, "Rút đề nghị". Nguoi kia de nghi: "Đồng ý xóa" (hoi lai mot lan vi khong lay lai
 * duoc) hay "Giữ lại". Moi luat nam o may chu; action lam moi trang (dong y xoa thi ve Ke sach).
 */
export function XoaCuon({ bookId, partnerNickname, deNghi, headingId }: XoaCuonProps) {
  const { loi, pending, chay } = useHanhDong();
  return (
    <section className="xoa-chung" aria-labelledby={headingId}>
      <h2 className="d" id={headingId}>Xóa cuốn</h2>
      {deNghi === "khong" && (
        <>
          <p>Sách viết cùng chỉ bị xóa khi cả hai đồng ý. Bạn đề nghị, {partnerNickname} đồng ý thì cuốn mới bị xóa.</p>
          <div className="xoa-chung__nut">
            <button type="button" className="btn btn--line" disabled={pending} aria-busy={pending || undefined} onClick={() => chay(() => actionDeNghiXoa(bookId))}>
              Đề nghị xóa
            </button>
          </div>
        </>
      )}
      {deNghi === "cua-toi" && (
        <>
          <p><b>Bạn đã đề nghị xóa.</b> Chờ {partnerNickname} đồng ý ở Kệ sách hay ở đây.</p>
          <div className="xoa-chung__nut">
            <button type="button" className="btn btn--line" disabled={pending} aria-busy={pending || undefined} onClick={() => chay(() => actionRutLai(bookId))}>
              Rút đề nghị
            </button>
          </div>
        </>
      )}
      {deNghi === "cua-kia" && (
        <>
          <p><b>{partnerNickname} đề nghị xóa cuốn này.</b> Đồng ý thì cuốn và mọi trang bị xóa hẳn, không lấy lại được.</p>
          <div className="xoa-chung__nut">
            <XacNhan
              nut="Đồng ý xóa"
              nutClass="btn btn--line"
              hoi="Xóa hẳn cuốn này?"
              dongY="Xóa hẳn"
              chay={() => actionTraLoi(bookId, true)}
            />
            <button type="button" className="btn btn--line" disabled={pending} aria-busy={pending || undefined} onClick={() => chay(() => actionTraLoi(bookId, false))}>
              Giữ lại
            </button>
          </div>
        </>
      )}
      {loi && <p className="form__loi" role="alert">{loi}</p>}
    </section>
  );
}

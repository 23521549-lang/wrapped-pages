"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { actionDoiTenLuot } from "@/app/actions/viet-cung";
import { parseTenLuot, TEN_LUOT_TOI_DA } from "@/lib/viet-cung";
import { useHanhDong } from "./hanh-dong";

export type TenLuotFormProps = { bookId: string; roundId: string; ordinal: number; ten: string | null };

const CAN_TEN = "Đặt tên cho lượt này nhé.";

/**
 * O "Tên lượt" cua man Sua luot trong sach viet cung (5c muc H3): doi ten luot cua chinh minh ma khong dung toi noi dung
 * luot. Luot chua co ten (luot cu) hien "Lượt N" lam chu goi y. Kiem som bang dung parseTenLuot cua may chu; may chu kiem
 * lai. Luu xong thi action lam moi trang, dong trang thai bao "Đã lưu tên.".
 */
export function TenLuotForm({ bookId, roundId, ordinal, ten }: TenLuotFormProps) {
  const id = useId();
  const [giaTri, setGiaTri] = useState(ten ?? "");
  const [thieu, setThieu] = useState(false);
  const [daLuu, setDaLuu] = useState(false);
  const oRef = useRef<HTMLInputElement>(null);
  const { loi, pending, chay } = useHanhDong();

  function luu(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDaLuu(false);
    const moi = parseTenLuot(giaTri);
    if (moi === null) {
      setThieu(true);
      oRef.current?.focus();
      return;
    }
    setThieu(false);
    chay(() => actionDoiTenLuot(bookId, roundId, moi), () => setDaLuu(true));
  }

  return (
    <form className="ten-luot ten-luot--sua" onSubmit={luu} noValidate>
      <label className="ten-luot__t" htmlFor={`${id}-o`}>Tên lượt</label>
      <p className="ten-luot__ghi" id={`${id}-ghi`}>Mỗi lượt trong sách viết cùng có tên riêng, như một chương.</p>
      <div className="ten-luot__hang">
        <input
          ref={oRef}
          className="input"
          id={`${id}-o`}
          type="text"
          value={giaTri}
          maxLength={TEN_LUOT_TOI_DA}
          placeholder={`Lượt ${ordinal}`}
          autoComplete="off"
          aria-invalid={thieu}
          aria-describedby={thieu ? `${id}-ghi ${id}-loi` : `${id}-ghi`}
          disabled={pending}
          onChange={(e) => {
            setGiaTri(e.target.value);
            setDaLuu(false);
          }}
        />
        <button type="submit" className="btn btn--line" disabled={pending} aria-busy={pending || undefined}>Lưu tên</button>
      </div>
      {thieu && <p className="form__loi" id={`${id}-loi`} role="alert">{CAN_TEN}</p>}
      {loi && <p className="form__loi" role="alert">{loi}</p>}
      <output className="ten-luot__xong">{daLuu ? "Đã lưu tên." : ""}</output>
    </form>
  );
}

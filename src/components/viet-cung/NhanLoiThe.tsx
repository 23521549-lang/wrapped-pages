"use client";

import { actionTraLoi } from "@/app/actions/viet-cung";
import { useHanhDong } from "./hanh-dong";
import { NgoiBut } from "./NgoiBut";

export type NhanLoiTheProps = {
  bookId: string;
  /** Biet danh nguoi gui loi moi (nguoi kia). */
  ten: string;
  /** Ten cuon, chi dung cho ten tro nang cua hai nut (man hinh da ve ten ngay tren). */
  title: string;
};

/**
 * Hai nut tra loi loi moi viet cung, nam ngay duoi mot cuon tren ke Hai Ngòi Bút (chu du an 02/10): cuon co loi moi dung
 * o ke chung cua ca hai tu luc gui, nen nguoi duoc moi tra loi ngay tai cuon chu khong phai tim dong rieng.
 * Khoi nay nam NGOAI the neo cua cuon: nut long trong mot the neo vua la HTML hong vua lam ban phim khong bam duoc nut.
 * Ten tro nang cua nut mang ten cuon, vi mot ke co nhieu cuon va "Nhận lời" khong noi len cuon nao.
 */
export function NhanLoiThe({ bookId, ten, title }: NhanLoiTheProps) {
  const { loi, pending, chay } = useHanhDong();
  return (
    <div className="cuon__moi">
      <p className="cuon__moi-chu"><NgoiBut />{ten} mời bạn viết cùng</p>
      <div className="cuon__moi-nut">
        <button
          type="button"
          className="btn btn--sm"
          aria-label={`Nhận lời viết cùng ${title}`}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() => chay(() => actionTraLoi(bookId, true))}
        >
          Nhận lời
        </button>
        <button
          type="button"
          className="btn btn--line btn--sm"
          aria-label={`Từ chối viết cùng ${title}`}
          disabled={pending}
          onClick={() => chay(() => actionTraLoi(bookId, false))}
        >
          Từ chối
        </button>
      </div>
      {loi && <p className="form__loi" role="alert">{loi}</p>}
    </div>
  );
}

"use client";

import { useId } from "react";
import { actionTraLoi } from "@/app/actions/viet-cung";
import type { LoaiDeNghi } from "@/lib/viet-cung";
import { useHanhDong } from "./hanh-dong";
import { NgoiBut } from "./NgoiBut";
import { XacNhan } from "./XacNhan";

/** Mot de nghi gui toi nguoi xem, dung nhung truong mot dong can (thanh phan trinh duyet: khong gui thua gi xuong). */
export type DongDeNghi = { bookId: string; title: string; loai: LoaiDeNghi };

/** Cau va hai nut cua tung loai de nghi (5c muc E4). */
const CAU: Record<LoaiDeNghi, { truoc: (ten: string) => string; dongY: string; khong: string }> = {
  "moi-viet": { truoc: (ten) => `${ten} mời bạn viết cùng `, dongY: "Nhận lời", khong: "Từ chối" },
  "xin-viet": { truoc: (ten) => `${ten} xin viết cùng `, dongY: "Đồng ý", khong: "Từ chối" },
  "xoa-sach": { truoc: (ten) => `${ten} đề nghị xóa `, dongY: "Đồng ý xóa", khong: "Giữ lại" },
};

/** Mot dong de nghi: dau hai ngoi but, cau (ten sach dam), hai nut; loi cua action hien ngay duoi dong. */
function Dong({ dong, partnerNickname }: { dong: DongDeNghi; partnerNickname: string }) {
  const id = useId();
  const cau = CAU[dong.loai];
  const { loi, pending, chay } = useHanhDong();
  return (
    <li className="loi-moi">
      <p className="loi-moi__chu" id={`${id}-cau`}>
        <NgoiBut />
        <span>{cau.truoc(partnerNickname)}<b>{dong.title}</b></span>
      </p>
      <div className="loi-moi__nut">
        {dong.loai === "xoa-sach" ? (
          // Xoa khong lay lai duoc: hoi lai mot lan, nhu muc Xoa cuon cua Sua sach.
          <XacNhan
            nut={cau.dongY}
            nutClass="btn btn--sm"
            hoi={`Xóa hẳn ${dong.title}?`}
            giai="Mọi trang bị xóa, không lấy lại được."
            dongY="Xóa hẳn"
            chay={() => actionTraLoi(dong.bookId, true)}
          />
        ) : (
          <button
            type="button"
            className="btn btn--sm"
            aria-describedby={`${id}-cau`}
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => chay(() => actionTraLoi(dong.bookId, true))}
          >
            {cau.dongY}
          </button>
        )}
        <button
          type="button"
          className="btn btn--line btn--sm"
          aria-describedby={`${id}-cau`}
          disabled={pending}
          onClick={() => chay(() => actionTraLoi(dong.bookId, false))}
        >
          {cau.khong}
        </button>
      </div>
      {loi && <p className="form__loi" role="alert">{loi}</p>}
    </li>
  );
}

/**
 * Cac dong de nghi viet cung gui toi nguoi xem, duoi dong dem sach o Ke sach (5c muc E4): cung cho va cung kieu dong nhac
 * thu. Moi dong xuong hang duoc o moi be rong (chu dong nhu biet danh va ten sach khong bao gio nam trong phan tu khong
 * xuong dong). Khong co de nghi nao thi khong ve gi.
 */
export function LoiMoi({ dong, partnerNickname }: { dong: readonly DongDeNghi[]; partnerNickname: string }) {
  if (dong.length === 0) return null;
  return (
    <ul className="loi-moi-ds" aria-label="Đề nghị viết cùng">
      {dong.map((d) => <Dong key={d.bookId} dong={d} partnerNickname={partnerNickname} />)}
    </ul>
  );
}

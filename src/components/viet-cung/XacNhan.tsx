"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useHanhDong } from "./hanh-dong";

export type XacNhanProps = {
  /** Chu cua nut mo hop (vd "Đồng ý xóa", "Xin viết cùng"). */
  nut: string;
  /** Lop cua nut mo hop. */
  nutClass: string;
  /** Cau hoi lai (dam). */
  hoi: string;
  /** Dong giai thich duoi cau hoi, neu can. */
  giai?: string;
  /** Chu cua nut dong y (vd "Xóa hẳn", "Gửi lời xin"). */
  dongY: string;
  /** Server action chay khi dong y. */
  chay: () => Promise<{ error: string } | undefined>;
  /** Noi dung dung truoc nut mo (vd dau hai ngoi but). */
  truocNut?: ReactNode;
};

/**
 * Mot nut mo hop hoi lai ngay trong trang (khong dung window.confirm), cung kieu hop xac nhan o Ban nhap: "Thôi" duoc focus
 * san; Esc hay Thoi dong hop va tra focus ve nut da mo no. Dong y thi chay action; loi hien ngay trong hop.
 */
export function XacNhan({ nut, nutClass, hoi, giai, dongY, chay, truocNut }: XacNhanProps) {
  const id = useId();
  const [mo, setMo] = useState(false);
  const { loi, pending, chay: chayAction, xoaLoi } = useHanhDong();
  const nutRef = useRef<HTMLButtonElement>(null);
  const thoiRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mo) thoiRef.current?.focus();
  }, [mo]);

  function dong() {
    setMo(false);
    xoaLoi();
    nutRef.current?.focus();
  }

  return (
    <>
      <button
        ref={nutRef}
        type="button"
        className={nutClass}
        aria-expanded={mo}
        aria-controls={mo ? `${id}-hoi` : undefined}
        onClick={() => setMo(true)}
      >
        {truocNut}
        {nut}
      </button>
      {mo && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bat tren ca nhom de dong hop du focus dang o nut nao trong hop.
        <div
          id={`${id}-hoi`}
          className="hoi-lai"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen chi co hai nut, cung ly do voi DraftRemove.
          role="group"
          aria-label={hoi}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || pending) return;
            e.preventDefault();
            dong();
          }}
        >
          <p className="hoi-lai__chu"><b>{hoi}</b>{giai ? ` ${giai}` : null}</p>
          <div className="hoi-lai__nut">
            <button ref={thoiRef} type="button" className="btn btn--sm" disabled={pending} onClick={dong}>Thôi</button>
            <button
              type="button"
              className="btn btn--line btn--sm"
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={() => chayAction(chay)}
            >
              {dongY}
            </button>
          </div>
          {loi && <p className="form__loi" role="alert">{loi}</p>}
        </div>
      )}
    </>
  );
}

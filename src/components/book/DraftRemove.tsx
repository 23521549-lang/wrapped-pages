"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { actionDeleteBook, actionDiscardDraft } from "@/app/actions/library";

/** Hai viec: xoa han cuon chua co trang dang, hay chi bo ban nhap cua cuon da co trang. */
const VIEC = {
  "xoa-sach": { nut: "Xóa sách", hoi: "Xóa hẳn cuốn sách này?", dongY: "Xóa", chay: actionDeleteBook, mat: "Chưa xóa được, thử lại." },
  "bo-nhap": { nut: "Bỏ bản nháp", hoi: "Bỏ bản nháp này?", dongY: "Bỏ", chay: actionDiscardDraft, mat: "Chưa bỏ được, thử lại." },
} as const;

export type DraftRemoveProps = {
  bookId: string;
  /** Cuon da co to dang: chi bo duoc ban nhap, khong xoa duoc sach. */
  hasPages: boolean;
  /** Id tieu de trang: xoa xong the bien mat, focus ve do thay vi roi vao body. */
  headingId: string;
  /** Lien ket Viet tiep, dung chung cum nut voi nut xoa. */
  children: ReactNode;
};

/**
 * Cum nut cua mot the o /ban-nhap: Viet tiep va nut Xoa sach (hoac Bo ban nhap), kem hop xac nhan hien ngay trong the
 * (khong dung window.confirm). Thoi duoc focus san; Esc hay Thoi dong hop va tra focus ve nut da mo no. Moi luat (chi
 * chu sach, chi cuon chua dang) nam o may chu; action lam moi trang khi xong.
 */
export function DraftRemove({ bookId, hasPages, headingId, children }: DraftRemoveProps) {
  const viec = VIEC[hasPages ? "bo-nhap" : "xoa-sach"];
  const id = useId();
  const [mo, setMo] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nutRef = useRef<HTMLButtonElement>(null);
  const thoiRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mo) thoiRef.current?.focus();
  }, [mo]);

  function dong() {
    setMo(false);
    setLoi(null);
    nutRef.current?.focus();
  }

  function dongY() {
    setLoi(null);
    startTransition(async () => {
      try {
        const r = await viec.chay(bookId);
        if (r?.error) {
          setLoi(r.error);
          return;
        }
        document.getElementById(headingId)?.focus();
      } catch {
        setLoi(viec.mat);
      }
    });
  }

  return (
    <>
      <div className="nhap__nut">
        {children}
        <button
          ref={nutRef}
          type="button"
          className="btn btn--quiet btn--sm"
          aria-expanded={mo}
          aria-controls={mo ? `${id}-hoi` : undefined}
          onClick={() => setMo(true)}
        >
          {viec.nut}
        </button>
      </div>
      {mo && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bat tren ca nhom de dong hop du focus dang o nut nao trong hop.
        <div
          id={`${id}-hoi`}
          className="nhap__hoi"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen chi co hai nut, khong phai o nhap cua form; cung ly do voi PublishBar.
          role="group"
          aria-label={viec.hoi}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || pending) return;
            e.preventDefault();
            dong();
          }}
        >
          <p className="dang-hoi__chu"><b>{viec.hoi}</b></p>
          <div className="dang-hoi__nut">
            <button ref={thoiRef} type="button" className="btn btn--sm" disabled={pending} onClick={dong}>Thôi</button>
            <button type="button" className="btn btn--line btn--sm" disabled={pending} aria-busy={pending || undefined} onClick={dongY}>
              {viec.dongY}
            </button>
          </div>
          {loi && <p className="luu luu--loi" role="alert">{loi}</p>}
        </div>
      )}
    </>
  );
}

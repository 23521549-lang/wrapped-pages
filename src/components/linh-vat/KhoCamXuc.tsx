"use client";

import { useEffect, useId, useRef, useState } from "react";
import { actionThaCamXuc } from "@/app/actions/cam-xuc";
import { CHUA_THA_CAM_XUC } from "@/app/actions/messages";
import { CAM_XUC, LOAI_CAM_XUC, type LoaiCamXuc } from "@/lib/cam-xuc";
import { AnhLinhVat } from "./AnhLinhVat";

/**
 * Kho cam xuc (5d, spec C5; 5e dua vao to tro chuyen): tam cam xuc, moi cam xuc mot linh vat; anh tinh cho nhe, ban dang
 * chon moi dong. Chon mot roi "Thả": goi action; xong thi bao len (daTha) de Chip hien loi "dang mang toi". Loi hien ngay
 * trong kho, lua chon giu nguyen. Mo ra thi focus vao ban dang chon (hay ban dau).
 */
export function KhoCamXuc({ tenMinh, tenKia, daTha }: { tenMinh: string; tenKia: string; daTha: (loai: LoaiCamXuc) => void }) {
  const id = useId();
  const [chon, setChon] = useState<LoaiCamXuc | null>(null);
  const [loi, setLoi] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const dsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    dsRef.current?.querySelector<HTMLButtonElement>(".cx")?.focus();
  }, []);

  async function tha() {
    if (chon === null || dangGui) return;
    setDangGui(true);
    setLoi("");
    try {
      const r = await actionThaCamXuc(chon);
      if ("error" in r) setLoi(r.error);
      else daTha(chon);
    } catch {
      setLoi(CHUA_THA_CAM_XUC);
    } finally {
      setDangGui(false);
    }
  }

  return (
    <div className="kho-cx" id={id}>
      <p className="kho-cx__phu">Mỗi cảm xúc có một bạn nhỏ mang tới {tenKia}.</p>
      <ul className="kho-cx__ds" ref={dsRef}>
        {LOAI_CAM_XUC.map((loai) => (
          <li key={loai}>
            <button
              type="button"
              className="cx"
              aria-pressed={chon === loai}
              onClick={() => {
                setChon(loai);
                setLoi("");
              }}
            >
              {chon === loai ? (
                <AnhLinhVat loai={loai} className="cx__hinh" />
              ) : (
                // oxlint-disable-next-line nextjs/no-img-element -- anh tinh tu public/ da thu nho san; next/image se bien WebP dong thanh anh qua may chu anh cua Next.
                <img className="cx__hinh" src={CAM_XUC[loai].anhTinh} alt="" width={176} height={176} decoding="async" />
              )}
              <span className="cx__ten">{CAM_XUC[loai].camXuc}</span>
            </button>
          </li>
        ))}
      </ul>
      {loi !== "" && <p className="form__loi" role="alert">{loi}</p>}
      <div className="kho-cx__chan">
        <p className="kho-cx__cau" aria-live="polite">
          {chon === null
            ? "Chưa chọn cảm xúc nào."
            : <>{`${CAM_XUC[chon].ten} sẽ nói với ${tenKia}: `}<b>{tenMinh}</b>{` ${CAM_XUC[chon].cau}`}</>}
        </p>
        <button type="button" className="btn" disabled={chon === null || dangGui} aria-busy={dangGui || undefined} onClick={() => void tha()}>
          Thả
        </button>
      </div>
    </div>
  );
}

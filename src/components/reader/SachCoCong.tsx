"use client";

import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { BiaMoSach, focusVungSach } from "./MoSach";

export type SachCoCongProps = {
  /** May chu tinh (congMoSach): loi vao khong co ?trang hay ?mo. Chi doc mot lan luc gan. */
  gate: boolean;
  /** Tam bia (BookCover), hien khi con cong. */
  cover: ReactNode;
  /** Khung Loi hoi dap cua cot phai, hay null khi cuon khong co (rieng tu, chua co to). Chi gan khi da qua cong. */
  side: ReactNode | null;
  /** Dau man doc va man doc. Con cong thi chua gan. */
  children: ReactNode;
};

/**
 * Man doc cua cuon KHONG co nhac, cung nghi thuc voi MusicRoom (chu du an chot 26/09: moi cuon deu mo qua tam bia): con
 * cong thi chi co tam bia va nut "Mở sách", noi dung sach va khung hoi dap chua gan, nen chua ghi to da xem, chua co
 * phim mui ten, chua chay nghi thuc. Mo roi thi la luoi hai cot (.doc-luoi) khi co khung hoi dap, mot cot khi khong.
 */
export function SachCoCong({ gate, cover, side, children }: SachCoCongProps) {
  const chinhRef = useRef<HTMLDivElement>(null);
  // Cong chi doc luc gan: refresh() ve lai trang khong duoc hien lai hay go tam bia giua chung.
  const [coCong] = useState(gate);
  const [daMo, setDaMo] = useState(false);
  const conBia = coCong && !daMo;

  function moSach() {
    flushSync(() => setDaMo(true));
    focusVungSach(chinhRef.current);
  }

  const chinh = (
    <div ref={chinhRef} tabIndex={-1} className={daMo ? "doc-luoi__chinh doc-luoi__chinh--mo" : "doc-luoi__chinh"}>
      {conBia ? <BiaMoSach cover={cover} onMo={moSach} /> : children}
    </div>
  );
  if (conBia || side === null) return chinh;
  return (
    <div className="doc-luoi">
      {chinh}
      <div className="doc-luoi__phu">{side}</div>
    </div>
  );
}

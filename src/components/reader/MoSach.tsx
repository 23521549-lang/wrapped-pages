import type { ReactNode } from "react";

/** Vung sach cua Flipbook: nhan focus ngay sau khi mo sach, va sau nghi thuc mo khoa khi focus dang roi o body. */
export const VUNG_SACH = ".doc__khung";

/**
 * Dua focus vao vung sach vua gan, hay vao chinh cot chinh (tabIndex -1) khi sach chua co to nao: nut "Mở sách" vua go
 * khoi DOM, de yen thi focus roi ve body va trinh doc man hinh mat cho dang doc. Goi SAU khi sach da gan dong bo
 * (flushSync), de vung sach da co trong cay va da het visibility hidden.
 */
export function focusVungSach(chinh: HTMLElement | null): void {
  (chinh?.querySelector<HTMLElement>(VUNG_SACH) ?? chinh)?.focus();
}

/** Tam bia va nut "Mở sách" cua cong man doc, dung chung cho cuon co nhac (MusicRoom) va cuon khong nhac (SachCoCong). */
export function BiaMoSach({ cover, onMo }: { cover: ReactNode; onMo: () => void }) {
  return (
    <div className="bia-mo">
      {cover}
      <button type="button" className="btn" onClick={onMo}>Mở sách</button>
    </div>
  );
}

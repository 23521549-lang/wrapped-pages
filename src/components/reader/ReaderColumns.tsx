import type { ReactNode } from "react";

/**
 * Man doc cua sach chia se khong co nhac: cung luoi hai cot voi MusicRoom (.doc-luoi), cot phai la khung Loi hoi dap.
 * Cot phai khong dinh vi thanh dieu huong cua man nay da dinh o tren. Duoi 980px cot phai xuong duoi cuon sach.
 */
export function ReaderColumns({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="doc-luoi">
      <div className="doc-luoi__chinh">{children}</div>
      <div className="doc-luoi__phu">{side}</div>
    </div>
  );
}

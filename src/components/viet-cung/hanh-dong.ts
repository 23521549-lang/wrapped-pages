import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";

/** Ket qua cua mot server action viet cung: undefined la xong (action tu lam moi trang hay chuyen trang). */
type KetQua = { error: string } | undefined;

const MAT_MANG = "Chưa làm được, thử lại nhé.";

/**
 * Chay mot server action trong transition, giu cau loi cua no (hay cau mat mang khi action nem loi). Loi dieu huong cua
 * redirect() (dong y xoa ve Ke sach) di tiep cho Next xu ly (unstable_rethrow, nhu PublishBar). Dung chung cho moi nut
 * cua sach viet cung.
 */
export function useHanhDong() {
  const [loi, setLoi] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function chay(action: () => Promise<KetQua>, xong?: () => void) {
    setLoi(null);
    startTransition(async () => {
      try {
        const r = await action();
        if (r?.error) setLoi(r.error);
        else xong?.();
      } catch (err) {
        unstable_rethrow(err);
        setLoi(MAT_MANG);
      }
    });
  }
  return { loi, pending, chay, xoaLoi: () => setLoi(null) };
}

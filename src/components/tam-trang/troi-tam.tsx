"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { TroiHien } from "@/lib/tam-trang/lich";

type TroiTamGiaTri = { tam: TroiHien | null; datTam: Dispatch<SetStateAction<TroiHien | null>> };

/** Ngoai trang ke sach (va trong bai kiem don le) khong co ai tha: troi tam luon rong, dat vao khong lam gi. */
const KHONG: TroiTamGiaTri = { tam: null, datTam: () => {} };
const Ngu = createContext<TroiTamGiaTri>(KHONG);

/**
 * Tam trang VUA THA cua nguoi xem, giu tam o trinh duyet cho toi khi may chu ve lai trang voi dung tam trang do (spec bo
 * sung B5). Hop "Thả tâm trạng" dat no ngay khi trang cuon toi dai troi, va dai troi ve no ngay, khong cho vong goi may
 * chu. May chu van la noi luu va kiem: tu choi thi hop go no di, dai troi ve lai tam trang cu va hop mo lai kem cau bao.
 * Boc ca dai troi lan hop tha tren trang ke sach; khong ve them the DOM nao, nen quy tac `.troi-dai + .shell` van dung.
 */
export function TroiTam({ children }: { children: ReactNode }) {
  const [tam, datTam] = useState<TroiHien | null>(null);
  const giaTri = useMemo(() => ({ tam, datTam }), [tam]);
  return <Ngu.Provider value={giaTri}>{children}</Ngu.Provider>;
}

export function useTroiTam(): TroiTamGiaTri {
  return useContext(Ngu);
}

/**
 * Hai bau troi la CUNG mot tam trang: cung kieu troi va cung loi nhan. Gio tha khong tinh: troi tam lay gio cua trinh
 * duyet, may chu lay gio luc luu, hai gio co the lech mot phut ma van la mot lan tha.
 */
export function cungTamTrang(a: TroiHien, b: TroiHien): boolean {
  return a.weather === b.weather && a.note === b.note;
}

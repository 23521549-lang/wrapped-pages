"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** Cac to dang hien cua sach lat: vi tri (tu 1) cua to dau va to cuoi co that cua khung dang dung yen. */
export type Shown = { first: number; last: number };

type ShownState = { shown: Shown; setShown: (next: Shown) => void };

const ShownSheets = createContext<ShownState | null>(null);

/** Khung khong doi thi giu nguyen doi tuong cu, de khong ai ve lai. */
function useShownState(start: number): ShownState {
  const [shown, datShown] = useState<Shown>({ first: start + 1, last: start + 1 });
  const setShown = useCallback((next: Shown) => {
    datShown((old) => (old.first === next.first && old.last === next.last ? old : next));
  }, []);
  return useMemo(() => ({ shown, setShown }), [shown, setShown]);
}

/**
 * To dang hien dung chung cho cot sach (Reader ghi qua onShow cua Flipbook) va cot phai (khung hoi dap theo luot cua to
 * dang hien). start la chi so to mo dau (tu 0, nhu Reader), nen lan ve o may chu da dung luot truoc khi Flipbook bao.
 * Dat o tren MusicRoom va khong bao gio go ra theo dieu kien: go ra la gan lai the nhac, tuc tai lai trinh phat.
 */
export function ShownSheetsProvider({ start, children }: { start: number; children: ReactNode }) {
  const value = useShownState(start);
  return <ShownSheets value={value}>{children}</ShownSheets>;
}

/**
 * Cho Reader: state cua provider neu co. Khong co provider (vd bai kiem Reader) thi state rieng, hanh vi y nhu truoc.
 * Hai hook duoc goi o moi lan ve de thu tu hook khong doi.
 */
export function useShownSheets(start: number): ShownState {
  const chung = useContext(ShownSheets);
  const rieng = useShownState(start);
  return chung ?? rieng;
}

/** Cho cot phai: cac to dang hien, hoac null khi khong nam trong provider. */
export function useShownRange(): Shown | null {
  return useContext(ShownSheets)?.shown ?? null;
}

/**
 * "mot": man hep, moi khung mot to. "doi": man rong, sach mo hai trang ghep (1,2), (3,4)...: to dau nam ngay ben
 * trai, khong de trang trai dau trong; so to le thi trang phai cua khung cuoi trong.
 */
export type FlipMode = "mot" | "doi";

/**
 * So to nhieu nhat mot khung cua sach lat hien cung luc (che do "doi" mo hai trang ghep). markRead tu choi khoang rong
 * hon con so nay: mot khoang rong hon khong the la mot khung nguoi doc that su nhin thay.
 */
export const MAX_SHOWN_SHEETS = 2;

export function viewCount(mode: FlipMode, n: number): number {
  if (n <= 0) return 1;
  return mode === "mot" ? n : Math.ceil(n / 2);
}

/** Cac to trong khung v, trai sang phai. null la cho trong (vi du ben phai cua khung cuoi khi so to le). */
export function viewSheets(mode: FlipMode, v: number, n: number): (number | null)[] {
  const at = (i: number) => (i >= 0 && i < n ? i : null);
  return mode === "mot" ? [at(v)] : [at(2 * v), at(2 * v + 1)];
}

/** Khung nhin chua to i. */
export function viewOf(mode: FlipMode, i: number): number {
  return mode === "mot" ? i : Math.floor(i / 2);
}

/** Nhan kieu "Trang 3 / 12" hoac "Trang 2-3 / 12". */
export function pageLabel(mode: FlipMode, v: number, n: number): string {
  const shown = viewSheets(mode, v, n).filter((i): i is number => i !== null).map((i) => i + 1);
  return `Trang ${shown.join("-")} / ${n}`;
}

/**
 * Nhung gi can ve khi lat tu khung v sang khung v + dir. front/back la hai mat cua la dang lat;
 * left/right la hai to dung yen phia duoi trong luc lat (che do mot trang chi dung right).
 * La xoay quanh gay tu fromDeg toi toDeg.
 */
export type FlipPlan = {
  front: number | null;
  back: number | null;
  left: number | null;
  right: number | null;
  fromDeg: 0 | -180;
  toDeg: 0 | -180;
};

export function flipPlan(mode: FlipMode, v: number, dir: 1 | -1, n: number): FlipPlan | null {
  const target = v + dir;
  if (target < 0 || target >= viewCount(mode, n)) return null;
  const at = (i: number) => (i >= 0 && i < n ? i : null);
  if (mode === "mot") {
    return dir === 1
      ? { front: at(v), back: null, left: null, right: at(v + 1), fromDeg: 0, toDeg: -180 }
      : { front: at(v - 1), back: null, left: null, right: at(v), fromDeg: -180, toDeg: 0 };
  }
  return dir === 1
    ? { front: at(2 * v + 1), back: at(2 * v + 2), left: at(2 * v), right: at(2 * v + 3), fromDeg: 0, toDeg: -180 }
    : { front: at(2 * v - 1), back: at(2 * v), left: at(2 * v - 2), right: at(2 * v + 1), fromDeg: -180, toDeg: 0 };
}

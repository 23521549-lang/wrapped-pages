/*
 * Nhip cua song nuoc khi doi cho hai bau troi o dai "O cua so". Ham thuan, khong cham DOM: chi cac moc thoi gian va bo
 * lay mau duong cong, de tinh luc mep song di qua tung dong chu. So lieu chep dung ban mau da duyet.
 */

/** Diem dieu khien duong cong cua mep song: di gan nhu deu tu dau toi cuoi, khong bung nhanh luc dau. */
export const SONG_EASE_P = [0.33, 0.02, 0.3, 1] as const;
export const SONG_EASE = `cubic-bezier(${SONG_EASE_P.join(", ")})`;

/** Song chinh lan het dai troi trong 2.6 giay. */
export const SONG_MS = 2600;
/** 3.15 giay thi ca vong phu cham nhat cung tan, luc do moi go cac lop tam. */
export const SONG_HET = 3150;
/** Chu cua troi moi hien dan trong 750ms, bat dau som hon mep song 80ms cho khoi giat. */
export const CHU_MS = 750;
export const CHU_SOM_MS = 80;
/** Toe o tam 1.5 giay; o cua so nay nhe 1.2 giay; kinh trong o mo ra 1.3 giay sau 60ms. */
export const TOE_MS = 1500;
export const NUT_MS = 1200;
export const KINH_MS = 1300;
export const KINH_TRE_MS = 60;

/** Vong o mep song va ba vong phu tat dan: [tre, dai, ty le cuoi, do dam]. */
export const VONG: readonly (readonly [number, number, number, number])[] = [
  [0, SONG_MS, 1, 0.45], [380, 2300, 0.955, 0.28], [860, 2050, 0.9, 0.17], [1400, 1700, 0.84, 0.09],
];
/** Ba vong toe ra tu tam o cua so: [tre, do dam]. */
export const TOE: readonly (readonly [number, number])[] = [[0, 0.5], [280, 0.34], [600, 0.2]];
/** O cua so nay nhu mat nuoc vua bi cham: chi transform. */
export const NUT_KHUNG: readonly { transform: string; offset?: number }[] = [
  { transform: "scale(1)" }, { transform: "scale(.965)", offset: 0.18 }, { transform: "scale(1.018)", offset: 0.46 },
  { transform: "scale(.996)", offset: 0.74 }, { transform: "scale(1)" },
];

/** Thoi diem (0..1) ma mep song dat tien do y (0..1) tren duong cong SONG_EASE. Lay mau 240 buoc, du min cho 2.6 giay. */
export function luc(y: number): number {
  const a = SONG_EASE_P;
  for (let i = 0; i <= 240; i++) {
    const u = i / 240;
    const yu = 3 * (1 - u) * (1 - u) * u * a[1] + 3 * (1 - u) * u * u * a[3] + u * u * u;
    if (yu >= y) return 3 * (1 - u) * (1 - u) * u * a[0] + 3 * (1 - u) * u * u * a[2] + u * u * u;
  }
  return 1;
}

/** Do tre (ms) cua mot dong chu cach tam song kc diem anh, khi song lan tu ban kinh r0 toi R. */
export function treChu(kc: number, r0: number, R: number): number {
  if (R <= r0) return 0;
  const t = luc(Math.min(1, Math.max(0, (kc - r0) / (R - r0))));
  return Math.max(0, Math.round(t * SONG_MS) - CHU_SOM_MS);
}

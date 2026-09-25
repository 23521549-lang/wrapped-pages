/*
 * So cot cua mot luoi CSS, doc tu chuoi grid-template-columns DA TINH cua trinh duyet.
 *
 * Ke sach dung repeat(auto-fill, minmax(...)), nen so cot la mot su that cua trinh duyet: no doi theo be rong cua so
 * VA theo co chu nguoi dung dat. Chep lai luat do trong JavaScript bang mot chuoi media query viet tay la dung hai
 * nguon su that cho mot gia tri, va hai nguon do se lech nhau ngay lan dau ai do sua CSS.
 */

/**
 * So cot suy tu chuoi da tinh, vi du "200px 200px 200px" cho ba cot; ten duong ke trong ngoac vuong khong phai cot.
 * Tra 1, gia tri an toan nhat (khung chi hien it sach hon chu khong bao gio hien sach le ra ngoai phan dang thay), khi
 * trinh duyet khong tra ve do rong da tinh:
 * - chuoi rong hay "none";
 * - luoi chua duoc ve (display none, hay con nam trong khoi an cua luong HTML dang truyen): trinh duyet tra ve gia tri
 *   KHAI BAO, vd "repeat(2, minmax(0px, 1fr))", ma dem khoang trang trong do ra ba "cot". ResizeObserver cua ngan ke se
 *   do lai ngay khi luoi duoc ve.
 */
export function soCot(gridTemplateColumns: string): number {
  const cot = gridTemplateColumns.replace(/\[[^\]]*\]/g, " ");
  if (cot.includes("(")) return 1;
  const so = cot.trim().split(/\s+/).filter((x) => x !== "" && x !== "none").length;
  return so > 0 ? so : 1;
}

/** So cuon vua dung `soTang` tang tren mot luoi `cot` cot. */
export function soCuonCuaTang(cot: number, soTang: number): number {
  return Math.max(1, cot) * soTang;
}

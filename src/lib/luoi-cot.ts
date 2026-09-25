/*
 * So cot cua mot luoi CSS, doc tu chuoi grid-template-columns DA TINH cua trinh duyet.
 *
 * Ke sach dung repeat(auto-fill, minmax(...)), nen so cot la mot su that cua trinh duyet: no doi theo be rong cua so
 * VA theo co chu nguoi dung dat. Chep lai luat do trong JavaScript bang mot chuoi media query viet tay la dung hai
 * nguon su that cho mot gia tri, va hai nguon do se lech nhau ngay lan dau ai do sua CSS.
 */

/**
 * So cot suy tu chuoi da tinh, vi du "200px 200px 200px" cho ba cot. Chuoi rong (chua gan vao cay, hay trinh duyet
 * khong tra ve gia tri da tinh) tra 1: mot cot la gia tri an toan nhat, khung chi hien it sach hon chu khong bao gio
 * hien sach le ra ngoai phan dang thay.
 */
export function soCot(gridTemplateColumns: string): number {
  const so = gridTemplateColumns.trim().split(/\s+/).filter((x) => x !== "" && x !== "none").length;
  return so > 0 ? so : 1;
}

/** So cuon vua dung `soTang` tang tren mot luoi `cot` cot. */
export function soCuonCuaTang(cot: number, soTang: number): number {
  return Math.max(1, cot) * soTang;
}

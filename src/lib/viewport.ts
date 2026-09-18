/** Khung chu nhat cua mot phan tu so voi khung nhin: dung cac truong cua DOMRect ma quaNuaTrongKhung can. */
export type KhungChuNhat = { top: number; bottom: number; left: number; right: number; width: number; height: number };

/**
 * Hon nua dien tich phan tu dang nam trong khung nhin rong x cao. Dung cho Required Minimum Functionality cua
 * YouTube: chi phat bang script khi hon nua trinh phat dang hien. Tinh theo dien tich phan giao chu khong theo tung
 * chieu, vi hon nua moi chieu chi bao dam hon mot phan tu dien tich. Phan tu khong co kich thuoc thi khong hien.
 */
export function quaNuaTrongKhung(rect: KhungChuNhat, rong: number, cao: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const doc = Math.max(0, Math.min(rect.bottom, cao) - Math.max(rect.top, 0));
  const ngang = Math.max(0, Math.min(rect.right, rong) - Math.max(rect.left, 0));
  return doc * ngang > (rect.width * rect.height) / 2;
}

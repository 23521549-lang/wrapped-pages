/**
 * Dua focus ve vung noi dung chinh (the main cua trang, tabIndex -1 nhu cot chinh cua man doc) khi chinh phan tu dang giu
 * focus vua bien mat: cua so nhac nho vua tat, hay cua so doc thu vua dong ma la thu troi mo ra no da di (thu da doc).
 * Khong thi focus roi ve body va nguoi dung ban phim bi day ve dau trang.
 */
export function focusVeTrang(): void {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
}

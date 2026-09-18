/**
 * Chuan hoa chuoi tieng Viet ve dang so khop duoc.
 * Luu y: NFD KHONG tach duoc "d" gach ngang, phai thay tay truoc.
 */
export function normalize(s: string): string {
  return s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

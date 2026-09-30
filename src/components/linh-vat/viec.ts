/*
 * Viec gan day trong phien (5e, spec D3): moi lan mo mot trang, GhiViec ghi "HH:MM mở {trang}" vao sessionStorage (chi
 * trinh duyet nay, het phien la mat); to tro chuyen gui kem khi hoi Chip de Chip biet nguoi dung vua lam gi. May chu kiem
 * va cat lai (lamSachViec), day chi la tien loi, khong phai du lieu tin cay.
 */

const KHOA = "mqce-chip-viec";
const TOI_DA = 10;

/** Ten trang dang mo: tieu de lon cua noi dung chinh, khong thi tieu de tai lieu. */
export function tenTrang(): string {
  const h1 = document.querySelector("main h1")?.textContent?.trim();
  return h1 !== undefined && h1 !== "" ? h1 : document.title;
}

export function docViec(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KHOA) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-TOI_DA) : [];
  } catch {
    return [];
  }
}

export function ghiViec(viec: string): void {
  try {
    const cu = docViec();
    if (cu.at(-1)?.endsWith(viec.slice(6))) return;
    sessionStorage.setItem(KHOA, JSON.stringify([...cu, viec].slice(-TOI_DA)));
  } catch {
    // Trinh duyet chan luu tru: Chip chi khong biet viec gan day, khong sao.
  }
}

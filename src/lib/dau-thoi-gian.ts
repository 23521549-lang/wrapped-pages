import { ngayTrongThang, thangCua, thangKhoa, type Thang } from "@/lib/tam-trang/lich";

/*
 * Trang Dau thoi gian ke lai dong thoi gian nhac cua MOT cuon tren mot lich thang, cung khung voi Lich hoa (chi con nhac
 * tu 28/09: chu du an khong can luu dau thoi gian cua bia). Mo dun thuan: nhan cac dau da doc san, tra ve dau theo ngay
 * cua mot thang. Khong mot phep doc nao theo tung thang - trang doc dong thoi gian mot lan roi gom o day. Ngay va thang
 * deu theo gio Viet Nam (thangCua, ngayTrongThang cua Lich hoa), nen may chay kiem hay may chu o mui gio nao cung vay.
 */

/**
 * Mot dau tren dong thoi gian nhac: o nao, cua luot nao, luc nao. ordinal null la o mo dau (luc tao sach); youtubeId
 * null la o GO NHAC.
 */
export type Dau = { key: string; ordinal: number | null; first: number | null; last: number | null; at: Date; youtubeId: string | null };

/**
 * Thu tu cua hai dau: theo luot (o mo dau truoc het), dung khoa sap xep cua ca dong thoi gian (thu tu luot) chu khong
 * theo gio, de trang nay khong the xep khac man Sua sach. Moi luot co nhieu nhat mot o nhac.
 */
function truocSau(a: Dau, b: Dau): number {
  return (a.ordinal ?? 0) - (b.ordinal ?? 0);
}

/** Dau moi nhat theo thu tu dong thoi gian (luot cao nhat); null khi chua co dau nao. Mot luot duyet, khong sap xep. */
function moiNhat(dau: readonly Dau[]): Dau | null {
  return dau.reduce<Dau | null>((max, d) => (max === null || truocSau(d, max) >= 0 ? d : max), null);
}

/** Ban sao cua cac dau, xep theo thu tu dong thoi gian (truocSau). */
export function xepTheoDong(dau: readonly Dau[]): Dau[] {
  // oxlint-disable-next-line unicorn/no-array-sort -- ban sao vua tao, khong ai khac giu tham chieu; toSorted can lib ES2023, du an dang o ES2022.
  return [...dau].sort(truocSau);
}

/** Cac dau cua thang `t`, gom theo ngay trong thang; moi ngay theo thu tu dong thoi gian. Ngay khong co dau thi khong co khoa. */
export function gomTheoNgay(dau: readonly Dau[], t: Thang): Record<number, Dau[]> {
  const khoa = thangKhoa(t);
  const ngay: Record<number, Dau[]> = {};
  for (const d of xepTheoDong(dau)) {
    if (thangKhoa(thangCua(d.at)) !== khoa) continue;
    (ngay[ngayTrongThang(d.at)] ??= []).push(d);
  }
  return ngay;
}

/**
 * Dau da dung san (co khoa thang "YYYY-MM" va ngay trong thang, tinh o may chu theo gio Viet Nam) gom theo thang roi
 * theo ngay, GIU thu tu dau vao. Trinh duyet gom lai o day de doi thang ngay tai cho ma khong phai hoi lai may chu, va
 * khong tu tinh mui gio nao.
 */
export function gomTheoThang<T extends { thang: string; ngay: number }>(dau: readonly T[]): Record<string, Record<number, T[]>> {
  const thang: Record<string, Record<number, T[]>> = {};
  for (const d of dau) ((thang[d.thang] ??= {})[d.ngay] ??= []).push(d);
  return thang;
}

/**
 * Vi tri cua bai phat duoc dau tien tu vi tri `tu` tro di trong danh sach nhac cua mot ngay (o go nhac thi khong phat
 * duoc); -1 khi het. Danh sach nhac trong ngay dung ham nay cho bai dau, bai ke tiep, va het bai hay bai hong.
 */
export function baiPhatDuoc(ds: readonly { youtubeId: string | null }[], tu: number): number {
  for (let i = Math.max(0, tu); i < ds.length; i++) if (ds[i].youtubeId !== null) return i;
  return -1;
}

/** Thang mo san: thang cua dau moi nhat; chua co dau nao thi thang cua `now`. */
export function thangMacDinh(dau: readonly Dau[], now: Date): Thang {
  const d = moiNhat(dau);
  return thangCua(d === null ? now : d.at);
}

/**
 * Ngay chon san trong thang dang xem: ngay cua dau moi nhat trong thang; thang khong co dau nao thi nhu Lich hoa, hom
 * nay khi la thang nay, con lai ngay cuoi thang.
 */
export function ngayMacDinh(ngay: Readonly<Record<number, readonly Dau[]>>, homNay: number | null, soNgay: number): number {
  const d = moiNhat(Object.values(ngay).flat());
  return d === null ? (homNay ?? soNgay) : ngayTrongThang(d.at);
}

const MAU_THANG = /^([0-9]{4})-(0[1-9]|1[0-2])$/;
const soThang = (t: Thang) => t.y * 12 + t.m - 1;

/**
 * Tham so `?thang=YYYY-MM`. Sai dinh dang, truoc thang cuon duoc tao, hay sau thang hien tai thi ve thang mac dinh,
 * khong bao loi: duong dan la thu ai cung go tay duoc.
 */
export function docThangSach(raw: unknown, tu: Thang, den: Thang, macDinh: Thang): Thang {
  if (typeof raw !== "string") return macDinh;
  const khop = MAU_THANG.exec(raw);
  if (khop === null) return macDinh;
  const t = { y: Number(khop[1]), m: Number(khop[2]) };
  return soThang(t) < soThang(tu) || soThang(t) > soThang(den) ? macDinh : t;
}

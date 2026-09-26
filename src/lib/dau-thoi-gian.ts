import type { CoverKey } from "@/lib/book";
import { ngayTrongThang, thangCua, thangKhoa, type Thang } from "@/lib/tam-trang/lich";

/*
 * Trang Dau thoi gian ke lai hai dong thoi gian bia va nhac cua MOT cuon tren mot lich thang, cung khung voi Lich hoa:
 * moi ngay mot o, lan tren la bia, lan duoi la nhac. Mo dun thuan: nhan cac dau da doc san, tra ve dau theo ngay cua mot
 * thang. Khong mot phep doc nao theo tung thang - trang doc hai dong thoi gian mot lan roi gom o day. Ngay va thang deu
 * theo gio Viet Nam (thangCua, ngayTrongThang cua Lich hoa), nen may chay kiem hay may chu o mui gio nao cung vay.
 */

/** Phan chung cua mot dau: o nao, cua luot nao, luc nao. ordinal null la o mo dau (luc tao sach). */
type DauChung = { key: string; ordinal: number | null; first: number | null; last: number | null; at: Date };

/** Mot dau tren dong thoi gian: mot o bia, hay mot o nhac (youtubeId null la o GO NHAC). */
export type Dau =
  | (DauChung & { loai: "bia"; cover: CoverKey; coverMediaId: string | null })
  | (DauChung & { loai: "nhac"; youtubeId: string | null });

/**
 * Thu tu cua hai dau: theo luot (o mo dau truoc het), cung luot thi bia truoc nhac. Dung dung khoa sap xep cua ca dong
 * thoi gian (thu tu luot) chu khong theo gio, de trang nay khong the xep khac man Sua sach.
 */
function truocSau(a: Dau, b: Dau): number {
  const la = a.ordinal ?? 0;
  const lb = b.ordinal ?? 0;
  if (la !== lb) return la - lb;
  return a.loai === b.loai ? 0 : a.loai === "bia" ? -1 : 1;
}

/** Dau moi nhat theo thu tu dong thoi gian (luot cao nhat); null khi chua co dau nao. Mot luot duyet, khong sap xep. */
function moiNhat(dau: readonly Dau[]): Dau | null {
  return dau.reduce<Dau | null>((max, d) => (max === null || truocSau(d, max) >= 0 ? d : max), null);
}

/** Cac dau cua thang `t`, gom theo ngay trong thang; moi ngay theo thu tu dong thoi gian. Ngay khong co dau thi khong co khoa. */
export function gomTheoNgay(dau: readonly Dau[], t: Thang): Record<number, Dau[]> {
  const khoa = thangKhoa(t);
  const ngay: Record<number, Dau[]> = {};
  for (const d of dau) {
    if (thangKhoa(thangCua(d.at)) !== khoa) continue;
    (ngay[ngayTrongThang(d.at)] ??= []).push(d);
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao o tren, khong ai khac giu tham chieu; toSorted can lib ES2023, du an dang o ES2022.
  for (const ds of Object.values(ngay)) ds.sort(truocSau);
  return ngay;
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

import type { CoverKey } from "@/lib/book";
import { dayKey } from "@/lib/when";

/*
 * Trang Dau thoi gian ke lai hai dong thoi gian bia va nhac cua MOT cuon, gom theo thang cua mot nam, giong Lich hoa.
 * Mo dun thuan: nhan cac dau da doc san, tra ve muoi hai o thang. Khong mot phep doc nao theo tung thang - trang doc
 * hai dong thoi gian mot lan roi gom o day.
 */

/** Phan chung cua mot dau: o nao, cua luot nao, luc nao. ordinal null la o mo dau (luc tao sach). */
type DauChung = { key: string; ordinal: number | null; first: number | null; last: number | null; at: Date };

/** Mot dau tren dong thoi gian: mot o bia, hay mot o nhac (youtubeId null la o GO NHAC). */
export type Dau =
  | (DauChung & { loai: "bia"; cover: CoverKey; coverMediaId: string | null })
  | (DauChung & { loai: "nhac"; youtubeId: string | null });

export type OThang = { thang: number; dau: Dau[] };

/** Nam va thang (1 toi 12) cua mot thoi diem, theo gio Viet Nam: may chay kiem hay may chu o mui gio nao cung vay. */
export function namThang(at: Date): { nam: number; thang: number } {
  const [nam, thang] = dayKey(at).split("-").map(Number);
  return { nam, thang };
}

/**
 * Thu tu cua hai dau trong cung mot thang: theo luot (o mo dau truoc het), cung luot thi bia truoc nhac. Dung dung
 * khoa sap xep cua ca dong thoi gian (thu tu luot) chu khong theo gio, de trang nay khong the xep khac man Sua sach.
 */
function truocSau(a: Dau, b: Dau): number {
  const la = a.ordinal ?? 0;
  const lb = b.ordinal ?? 0;
  if (la !== lb) return la - lb;
  return a.loai === b.loai ? 0 : a.loai === "bia" ? -1 : 1;
}

/** Muoi hai o thang cua nam `nam`, du ca thang trong. Moi o giu cac dau cua thang do theo thu tu luot. */
export function gomTheoThang(dau: readonly Dau[], nam: number): OThang[] {
  const o: OThang[] = Array.from({ length: 12 }, (_, i) => ({ thang: i + 1, dau: [] }));
  for (const d of dau) {
    const t = namThang(d.at);
    if (t.nam === nam) o[t.thang - 1].dau.push(d);
  }
  for (const x of o) x.dau.sort(truocSau);
  return o;
}

/** Cac nam co it nhat mot dau, tang dan, khong trung. */
export function namCo(dau: readonly Dau[]): number[] {
  return [...new Set(dau.map((d) => namThang(d.at).nam))].sort((a, b) => a - b);
}

/** Dau moi nhat theo thu tu dong thoi gian (luot cao nhat); null khi chua co dau nao. */
function moiNhat(dau: readonly Dau[]): Dau | null {
  return dau.length === 0 ? null : [...dau].sort(truocSau)[dau.length - 1];
}

/** Nam mac dinh: nam cua dau moi nhat. Chua co dau nao thi la nam cua `now`. */
export function namMacDinh(dau: readonly Dau[], now: Date): number {
  const d = moiNhat(dau);
  return namThang(d === null ? now : d.at).nam;
}

/** Thang mac dinh cua mot nam: thang cua dau moi nhat trong nam do; null khi ca nam khong co dau nao. */
export function thangMacDinh(oThang: readonly OThang[]): number | null {
  const d = moiNhat(oThang.flatMap((o) => o.dau));
  return d === null ? null : namThang(d.at).thang;
}

/**
 * Doc tham so `?nam=` tu duong dan. Sai dinh dang, truoc nam cuon duoc tao, hay sau nam hien tai thi ve nam mac dinh,
 * khong bao loi: duong dan la thu ai cung go tay duoc.
 */
export function docNam(raw: unknown, namTao: number, namNay: number, macDinh: number): number {
  if (typeof raw !== "string" || !/^[0-9]{4}$/.test(raw)) return macDinh;
  const n = Number(raw);
  return n < namTao || n > namNay ? macDinh : n;
}

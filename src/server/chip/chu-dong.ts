import { CHU_DONG_NGHI_MS, VANG_LAU_MS, XAC_SUAT_CHU_DONG } from "@/lib/chip";
import { feedLine } from "@/lib/feed/line";
import type { FeedItem, FeedKind } from "@/lib/feed/types";
import { dayKey } from "@/lib/when";

/*
 * Chip chu dong bat chuyen (dot nam 5e mo rong): chon su kien vua xay ra de hoi tham, mo ta no cho loi dan, va cac
 * cong xac suat/cooldown. Ham thuan, khong doc DB hay goi AI; ham may chu goi Groq + luu tin them o manh 2.
 */

/** Loai hoat dong cua chinh nguoi xem co the khien Chip bat chuyen (phase 1). */
export const KIND_CUA_MINH = ["tha-tam-trang", "tao-sach", "dang-trang", "gui-thu", "tha-cam-xuc"] as const;
export type KieuSuKien = (typeof KIND_CUA_MINH)[number] | "viec-doi-phuong" | "mo-trang";

/** Loai viec moi cua doi phuong co the khien Chip bat chuyen (T8): thu, tam trang, cam xuc, trang moi. */
export const KIND_CUA_KIA: readonly FeedKind[] = ["tha-tam-trang", "gui-thu", "tha-cam-xuc", "dang-trang"];

/** Mot su kien de bat chuyen: ma dedup, cau mo ta cho loi dan, lien ket tuy chon toi cho lien quan. */
export type SuKienChuDong = { kieu: KieuSuKien; ma: string; moTa: string; href: string | null };

const laKindCuaMinh = (kind: FeedKind): kind is (typeof KIND_CUA_MINH)[number] =>
  (KIND_CUA_MINH as readonly string[]).includes(kind);

/** Duong dan mo trang co the khien Chip bat chuyen (T1): tao sach moi, trang viet, trang tam trang. */
export function laTrangBatChuyen(duongDan: string): boolean {
  return duongDan === "/sach/moi" || duongDan === "/tam-trang" || /^\/sach\/[^/]+\/viet$/.test(duongDan);
}

/** Ten hien cho trang bat chuyen (chi de mo ta su kien trong loi dan). */
function tenTrangBatChuyen(duongDan: string): string {
  if (duongDan === "/sach/moi") return "trang tạo sách mới";
  if (duongDan === "/tam-trang") return "trang Thả tâm trạng";
  return "trang viết";
}

/**
 * Cau mo ta mot dong Hoat dong cho loi dan chu dong: cau nhu cot Hoat dong, doi "Ban" thanh ten minh khi la viec cua
 * minh, kem loi nhan neu co (vd tam trang kem loi nhan). Khong mang id noi bo.
 */
export function moTaSuKien(item: FeedItem, tenMinh: string, tenKia: string): string {
  const line = feedLine(item, { partner: tenKia });
  const cau = line.sentence.map((d) => d.chu).join("");
  const cuaMinh = item.by === "me" ? cau.replace(/^Bạn/, tenMinh) : cau;
  return line.extra === null ? cuaMinh : `${cuaMinh} (${line.extra.text})`;
}

/**
 * Chon mot su kien de Chip bat chuyen tu cac dong Hoat dong vua doc (da loc Khoang Lang o listActivity).
 * Thu tu: viec moi nhat cua minh (T2-T6) -> mo trang dang lam (T1) -> viec moi nhat cua doi phuong (T8, chi khi
 * Khoang Lang tat). Chi xet viec sau moc (lan bat chuyen truoc, hay 6 tieng truoc neu chua tung bat chuyen);
 * viec moi nhat da tung bat chuyen (ma trung chuDongMa) thi thoi, khong dao viec cu hon.
 */
export function chonSuKien(
  items: FeedItem[],
  opt: {
    chuDongLuc: Date | null;
    chuDongMa: string | null;
    khoangLang: boolean;
    duongDan: string;
    tenMinh: string;
    tenKia: string;
    now: Date;
  },
): SuKienChuDong | null {
  const tu = opt.chuDongLuc ?? new Date(opt.now.getTime() - VANG_LAU_MS);
  // oxlint-disable-next-line unicorn/no-array-sort -- ban sao vua tao, khong ai khac giu tham chieu; toSorted can lib ES2023, du an dang o ES2022.
  const moi = [...items].sort((a, b) => b.at.getTime() - a.at.getTime());
  const cuaMinh = moi.find((i) => i.by === "me" && i.at > tu && laKindCuaMinh(i.kind));
  if (cuaMinh !== undefined && laKindCuaMinh(cuaMinh.kind)) {
    if (cuaMinh.id === opt.chuDongMa) return null;
    return { kieu: cuaMinh.kind, ma: cuaMinh.id, moTa: moTaSuKien(cuaMinh, opt.tenMinh, opt.tenKia), href: feedLine(cuaMinh, { partner: opt.tenKia }).href };
  }
  if (laTrangBatChuyen(opt.duongDan)) {
    const ma = `mo-trang:${opt.duongDan}:${dayKey(opt.now)}`;
    if (ma !== opt.chuDongMa) {
      return { kieu: "mo-trang", ma, moTa: `đang mở ${tenTrangBatChuyen(opt.duongDan)}`, href: opt.duongDan };
    }
  }
  if (!opt.khoangLang) {
    const cuaKia = moi.find((i) => i.by === "partner" && i.isNew && i.at > tu && (KIND_CUA_KIA as readonly string[]).includes(i.kind));
    if (cuaKia !== undefined && cuaKia.id !== opt.chuDongMa) {
      return { kieu: "viec-doi-phuong", ma: cuaKia.id, moTa: moTaSuKien(cuaKia, opt.tenMinh, opt.tenKia), href: feedLine(cuaKia, { partner: opt.tenKia }).href };
    }
  }
  return null;
}

/** Co hoi nay co thanh loi chu dong khong (xac suat 60%): ngauNhien tiem duoc de test. */
export function coTheNoi(ngauNhien: () => number = Math.random): boolean {
  return ngauNhien() < XAC_SUAT_CHU_DONG;
}

/** Da het cooldown 30 phut tu lan bat chuyen truoc chua (chua tung bat chuyen thi het). */
export function hetNghi(chuDongLuc: Date | null, now: Date): boolean {
  return chuDongLuc === null || now.getTime() - chuDongLuc.getTime() >= CHU_DONG_NGHI_MS;
}

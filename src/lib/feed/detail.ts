import { COVERS, type CoverKey } from "@/lib/book";
import { laLoaiCamXuc, type LoaiCamXuc } from "@/lib/cam-xuc";
import { phanThang } from "@/lib/tam-trang/lich";
import { isUuid } from "@/lib/uuid";
import { LOAI_DE_NGHI, type LoaiDeNghi } from "@/lib/viet-cung";
import { YOUTUBE_ID } from "@/lib/youtube";

/*
 * Cot detail (jsonb) cua bang activity, theo loai. Database chi bat no la mot object va chi co o nam loai
 * (CHECK activity_detail); hinh dang ben trong do cac ham doc duoi day kiem. Sai hinh (du lieu la, ban cu) thi tra null:
 * dong Hoat dong bo nhan cua no chu khong vo.
 */

/**
 * Gia tri mot o bia: tranh, va anhId khi o dung anh tu tai len (tranh la tranh du phong cua anh); null la "Giữ bìa
 * trước". Giu ma anh chu khong chi co/khong: doi tu anh nay sang anh khac cung la mot lan doi.
 */
export type GiaTriBia = { cover: CoverKey; anhId: string | null } | null;
/** Gia tri mot o nhac: ma video, hay youtubeId null la o tat nhac; null la "Phát tiếp bài trước" (khong co o). */
export type GiaTriNhac = { youtubeId: string | null } | null;

export type ChiTietTen = { truoc: string; sau: string };
export type ChiTietBia = { truoc: GiaTriBia; sau: GiaTriBia };
export type ChiTietNhac = { truoc: GiaTriNhac; sau: GiaTriNhac };
export type ChiTietDaDoc = { den: number };
/** Thu cua thang nao (YYYY-MM): chi thang, noi dung thu khong bao gio nam o dong Hoat dong. */
export type ChiTietThu = { thang: string };
/** Nhan loi viet cung (5c): tu mot loi moi hay mot loi xin, de chon cau. */
export type ChiTietNhanViet = { tu: "moi-viet" | "xin-viet" };
/** Tu choi mot de nghi (5c): loi moi, loi xin hay de nghi xoa. */
export type ChiTietTuChoi = { viec: LoaiDeNghi };
/** Doi ten luot (5c): ten cu (null la luot chua dat ten, hien "Lượt N") va ten moi. */
export type ChiTietTenLuot = { truoc: string | null; sau: string };
/** Tha cam xuc (5d): loai cam xuc. */
export type ChiTietCamXuc = { cam: LoaiCamXuc };

const laObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const tenHopLe = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function docBia(v: unknown): GiaTriBia | undefined {
  if (v === null) return null;
  if (!laObject(v) || !(COVERS as readonly unknown[]).includes(v.cover)) return undefined;
  const { anhId } = v;
  if (anhId !== null && !(typeof anhId === "string" && isUuid(anhId))) return undefined;
  return { cover: v.cover as CoverKey, anhId };
}

function docNhac(v: unknown): GiaTriNhac | undefined {
  if (v === null) return null;
  if (!laObject(v) || !("youtubeId" in v)) return undefined;
  const { youtubeId } = v;
  if (youtubeId === null) return { youtubeId: null };
  return typeof youtubeId === "string" && YOUTUBE_ID.test(youtubeId) ? { youtubeId } : undefined;
}

/** Hai phia truoc va sau cua mot lan doi, doc bang cung mot ham; thieu hay sai mot phia thi ca doi la null. */
function docDoi<T>(v: unknown, doc: (x: unknown) => T | undefined): { truoc: T; sau: T } | null {
  if (!laObject(v) || !("truoc" in v) || !("sau" in v)) return null;
  const truoc = doc(v.truoc);
  const sau = doc(v.sau);
  return truoc === undefined || sau === undefined ? null : { truoc, sau };
}

export const docChiTietTen = (v: unknown): ChiTietTen | null => docDoi(v, (x) => (tenHopLe(x) ? x : undefined));
export const docChiTietBia = (v: unknown): ChiTietBia | null => docDoi(v, docBia);
export const docChiTietNhac = (v: unknown): ChiTietNhac | null => docDoi(v, docNhac);

export function docChiTietDaDoc(v: unknown): ChiTietDaDoc | null {
  return laObject(v) && Number.isInteger(v.den) && (v.den as number) >= 1 ? { den: v.den as number } : null;
}

export function docChiTietThu(v: unknown): ChiTietThu | null {
  return laObject(v) && phanThang(v.thang) !== null ? { thang: v.thang as string } : null;
}

export function docChiTietCamXuc(v: unknown): ChiTietCamXuc | null {
  return laObject(v) && laLoaiCamXuc(v.cam) ? { cam: v.cam } : null;
}

export function docChiTietNhanViet(v: unknown): ChiTietNhanViet | null {
  return laObject(v) && (v.tu === "moi-viet" || v.tu === "xin-viet") ? { tu: v.tu } : null;
}

export function docChiTietTuChoi(v: unknown): ChiTietTuChoi | null {
  return laObject(v) && (LOAI_DE_NGHI as readonly unknown[]).includes(v.viec) ? { viec: v.viec as LoaiDeNghi } : null;
}

export function docChiTietTenLuot(v: unknown): ChiTietTenLuot | null {
  if (!laObject(v) || !("truoc" in v) || !tenHopLe(v.sau)) return null;
  const { truoc } = v;
  return truoc === null || tenHopLe(truoc) ? { truoc, sau: v.sau } : null;
}

/**
 * Hai gia tri truoc va sau cua mot lan doi co bang nhau theo noi dung khong: doi roi doi lai nhu cu thi dong gop bi
 * xoa (khong co gi doi de bao). Chi so cac gia tri cua cac kieu tren: chuoi, null va object phang.
 */
export function giongNhau(a: GiaTriBia | GiaTriNhac | string, b: GiaTriBia | GiaTriNhac | string): boolean {
  if (a === null || b === null || typeof a === "string" || typeof b === "string") return a === b;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

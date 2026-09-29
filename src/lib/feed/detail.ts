import { COVERS, type CoverKey } from "@/lib/book";
import { isUuid } from "@/lib/uuid";
import { YOUTUBE_ID } from "@/lib/youtube";

/*
 * Cot detail (jsonb) cua bang activity, theo loai. Database chi bat no la mot object va chi co o bon loai
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

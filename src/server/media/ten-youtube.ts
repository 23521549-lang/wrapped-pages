import { YOUTUBE_ID } from "@/lib/youtube";

/*
 * Ten bai va kenh cua nhac nen, cho danh sach "Nhạc trong ngày" o trang Dau thoi gian (spec bo sung B4 ban hai). Web
 * chi luu ma video, nen ten lay tu oEmbed cua YouTube, o PHIA MAY CHU: trinh duyet khong goi them mien nao, CSP khong
 * noi dong nao. Lay khong duoc (mat mang, video bi go, YouTube cham) thi khong co ten, va giao dien ghi "Bản nhạc trên
 * YouTube": ten bai la phan trang tri, khong bao gio duoc lam trang cham hay hong.
 */

/** Ten bai va kenh cua mot video. */
export type TenBai = { ten: string; kenh: string | null };

/** Chi phan cua fetch ma module nay dung, de bai kiem thay bang ban gia. */
export type LayVe = (url: string, init: { signal: AbortSignal; cache: "no-store" }) => Promise<Pick<Response, "ok" | "json">>;

/** Moi lan hoi YouTube cho toi da chung nay; cac ma hoi song song nen ca trang cung chi cho chung nay. */
const HAN_MS = 1500;
/** Ten bai gan nhu khong doi: giu mot tuan. Lan hoi hong giu ngan, de mat mang mot luc khong lam moi lan mo trang cham. */
const GIU_CO_MS = 7 * 24 * 60 * 60 * 1000;
const GIU_LOI_MS = 10 * 60 * 1000;
/** Tran bo nho dem: bo ma cu nhat truoc. */
const TOI_DA = 500;
/** Ten dai qua muc nay thi cat: danh sach nam trong mot cot hep. */
const DAI_TOI_DA = 200;

const chuoi = (x: unknown): string | null => {
  const s = typeof x === "string" ? x.trim().slice(0, DAI_TOI_DA) : "";
  return s === "" ? null : s;
};

/** Doc than oEmbed; thieu title thi coi nhu khong co ten. */
function docTen(json: unknown): TenBai | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  const ten = chuoi(o.title);
  return ten === null ? null : { ten, kenh: chuoi(o.author_name) };
}

/** Duong oEmbed cua mot ma video da qua YOUTUBE_ID: khong bao gio ghep chuoi chua kiem vao duong dan. */
export function duongOembed(id: string): string {
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
}

/**
 * Tao mot bo tra ten bai co bo nho dem rieng. Tra ve ham nhan cac ma video (lap, sai dang deu duoc), hoi YouTube song
 * song cho nhung ma chua co hay da het han, va tra ban do ma -> ten cho nhung ma co ten.
 */
export function taoBoTenBai(layVe: LayVe, gio: () => number = Date.now): (ids: readonly string[]) => Promise<Record<string, TenBai>> {
  const nho = new Map<string, { bai: TenBai | null; het: number }>();
  const layMot = async (id: string): Promise<TenBai | null> => {
    try {
      const r = await layVe(duongOembed(id), { signal: AbortSignal.timeout(HAN_MS), cache: "no-store" });
      return r.ok ? docTen(await r.json()) : null;
    } catch {
      return null;
    }
  };
  return async (ids) => {
    const can = [...new Set(ids)].filter((id) => YOUTUBE_ID.test(id));
    const now = gio();
    const thieu = can.filter((id) => (nho.get(id)?.het ?? 0) <= now);
    const moi = await Promise.all(thieu.map(async (id) => [id, await layMot(id)] as const));
    for (const [id, bai] of moi) {
      // Xoa roi dat lai: ma vua hoi thanh ma moi nhat theo thu tu chen, ma cu nhat bi bo truoc khi tran.
      nho.delete(id);
      nho.set(id, { bai, het: now + (bai === null ? GIU_LOI_MS : GIU_CO_MS) });
    }
    const ra: Record<string, TenBai> = {};
    for (const id of can) {
      const bai = nho.get(id)?.bai;
      if (bai) ra[id] = bai;
    }
    for (const id of nho.keys()) {
      if (nho.size <= TOI_DA) break;
      nho.delete(id);
    }
    return ra;
  };
}

/** Bo tra ten bai dung chung cua may chu. */
export const tenCacBai = taoBoTenBai((url, init) => fetch(url, init));

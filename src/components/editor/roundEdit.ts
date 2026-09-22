import type { JSONContent } from "@tiptap/core";
import type { DocJson } from "@/lib/doc/types";
import { checkDraftInput } from "@/lib/doc/validate";
import { mediaIdsOf } from "@/lib/media/node";

/** Co media nao cua ban goc khong con trong tai lieu dang sua: dem theo id, nen bo A them B van la bo. */
export function droppedMedia(original: DocJson, current: JSONContent): boolean {
  const khoi = (current.content ?? []).filter((b): b is JSONContent & { type: string } => typeof b.type === "string");
  const con = new Set(mediaIdsOf({ content: khoi }));
  return mediaIdsOf(original).some((id) => !con.has(id));
}

/** Tien to khoa ban tam cua man sua luot trong sessionStorage. */
export const ROUND_EDIT_PREFIX = "mqce-sua-luot-";

/** Tien to ban tam cua man sua mot to da bo: ban tam con sot trong mot the dang mo khong bao gio dung toi nua. */
const PREFIX_SUA_TO_CU = "mqce-sua-trang-";

/**
 * Ban tam cua luot khac song lau nhat chung nay: mo man sua mot luot thi ban tam cu hon cua cac luot kia bi xoa. Du dai
 * cho mot buoi sua do dang, du ngan de sessionStorage cua mot the mo nhieu ngay khong phinh ra.
 */
export const ROUND_EDIT_TEMP_MAX_MS = 24 * 60 * 60_000;

/** Khoa ban tam cua mot luot: chi chu sach mo duoc man sua, va sessionStorage rieng tung the. */
export function roundEditKey(roundId: string): string {
  return `${ROUND_EDIT_PREFIX}${roundId}`;
}

/** Chuoi ban tam { version, doc, at } de ghi vao sessionStorage; at la luc ghi (ms), de don ban tam cu. */
export function roundEditTemp(version: string, doc: JSONContent, at: number): string {
  return JSON.stringify({ version, doc, at });
}

/**
 * Khoa ban tam can xoa khi mo man sua luot co khoa `khoa`: ban tam cua luot khac cu hon ROUND_EDIT_TEMP_MAX_MS hay khong
 * doc duoc luc ghi, va moi ban tam cua man sua mot to da bo. Ban tam cua chinh luot nay do readRoundEditTemp xet (theo
 * version); khoa khong phai ban tam khong bao gio bi dung toi. Thuan: nhan san cac cap [khoa, gia tri].
 */
export function staleRoundTempKeys(entries: Iterable<[string, string | null]>, khoa: string, now: number): string[] {
  const out: string[] = [];
  for (const [key, raw] of entries) {
    if (key.startsWith(PREFIX_SUA_TO_CU)) {
      out.push(key);
      continue;
    }
    if (!key.startsWith(ROUND_EDIT_PREFIX) || key === khoa) continue;
    let at: unknown;
    try {
      at = (JSON.parse(raw ?? "") as { at?: unknown } | null)?.at;
    } catch {
      at = undefined;
    }
    if (typeof at !== "number" || !Number.isFinite(at) || now - at > ROUND_EDIT_TEMP_MAX_MS) out.push(key);
  }
  return out;
}

/**
 * Doc ban tam { version, doc }. Chi tra tai lieu khi doc duoc, cung moc phien ban voi luot hien tai (ban tam cu khong bao
 * gio de len noi dung vua duoc sua o noi khac) va tai lieu qua duoc phep kiem cua ban nhap.
 */
export function readRoundEditTemp(raw: string | null, version: string): JSONContent | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { version: moc, doc } = value as { version?: unknown; doc?: unknown };
  if (moc !== version || typeof doc !== "object" || doc === null) return null;
  return checkDraftInput(doc).ok ? (doc as JSONContent) : null;
}

import type { JSONContent } from "@tiptap/core";
import type { DocJson } from "@/lib/doc/types";
import { checkDraftInput } from "@/lib/doc/validate";
import { mediaIdsOf } from "@/lib/media/node";

type Nut = { type?: string; content?: Nut[]; attrs?: Record<string, unknown>; noiTiep?: unknown; [k: string]: unknown };

function doi(node: Nut, fn: (node: Nut) => Nut): Nut {
  const out = fn(node);
  return out.content ? { ...out, content: out.content.map((con) => doi(con, fn)) } : out;
}

/**
 * To da dang sang tai lieu cua trinh soan thao man sua: dau noiTiep cua muc danh sach (chi co tren to da dang, xem
 * src/lib/doc/types.ts) doi thanh attrs.noiTiep ma MucNoiTiep hieu. Thuan, khong doi dau vao.
 */
export function toEditorDoc(doc: DocJson): JSONContent {
  return doi(structuredClone(doc) as Nut, (node) => {
    if (node.type !== "listItem") return node;
    const { noiTiep, ...rest } = node;
    return noiTiep === true ? { ...rest, attrs: { noiTiep: true } } : rest;
  }) as JSONContent;
}

/**
 * Nguoc lai toEditorDoc: attrs.noiTiep === true thanh noiTiep, moi attrs khac cua muc danh sach bi bo (trinh soan thao
 * sinh { noiTiep: null } cho moi muc). Dau ra van phai qua checkDraftInput nhu moi tai lieu tu trinh duyet.
 */
export function fromEditorDoc(json: JSONContent): unknown {
  return doi(structuredClone(json) as Nut, (node) => {
    if (node.type !== "listItem") return node;
    const { attrs, ...rest } = node;
    return attrs?.noiTiep === true ? { ...rest, noiTiep: true } : rest;
  });
}

/** Co media nao cua ban goc khong con trong tai lieu dang sua: dem theo id, nen bo A them B van la bo. */
export function droppedMedia(original: DocJson, current: JSONContent): boolean {
  const khoi = (current.content ?? []).filter((b): b is JSONContent & { type: string } => typeof b.type === "string");
  const con = new Set(mediaIdsOf({ content: khoi }));
  return mediaIdsOf(original).some((id) => !con.has(id));
}

/** Tien to khoa ban tam cua man sua mot to trong sessionStorage. */
export const PAGE_EDIT_PREFIX = "mqce-sua-trang-";

/** Khoa ban tam cua mot to: chi chu sach mo duoc man sua, va sessionStorage rieng tung the. */
export function pageEditKey(bookId: string, position: number): string {
  return `${PAGE_EDIT_PREFIX}${bookId}-${position}`;
}

/**
 * Ban tam cua to khac cung cuon song lau nhat chung nay: mo man sua mot to thi ban tam cu hon cua cac to kia bi xoa.
 * Du dai cho mot buoi sua do dang, du ngan de sessionStorage cua mot the mo nhieu ngay khong phinh ra.
 */
export const PAGE_EDIT_TEMP_MAX_MS = 24 * 60 * 60_000;

/** Chuoi ban tam { version, doc, at } de ghi vao sessionStorage; at la luc ghi (ms), de don ban tam cu. */
export function pageEditTemp(version: string, doc: JSONContent, at: number): string {
  return JSON.stringify({ version, doc, at });
}

/**
 * Khoa ban tam can xoa khi mo man sua to position cua cuon bookId: ban tam cua to khac cung cuon ma cu hon
 * PAGE_EDIT_TEMP_MAX_MS, hay khong doc duoc luc ghi. Ban tam cua chinh to nay do readPageEditTemp xet (theo version),
 * khoa cua cuon khac va khoa khong phai ban tam khong bao gio bi dung toi. Thuan: nhan san cac cap [khoa, gia tri].
 */
export function staleTempKeys(entries: Iterable<[string, string | null]>, bookId: string, position: number, now: number): string[] {
  const dau = `${PAGE_EDIT_PREFIX}${bookId}-`;
  const out: string[] = [];
  for (const [key, raw] of entries) {
    if (!key.startsWith(dau)) continue;
    const so = key.slice(dau.length);
    if (!/^[1-9][0-9]*$/.test(so) || Number(so) === position) continue;
    let at: unknown;
    try {
      at = (JSON.parse(raw ?? "") as { at?: unknown } | null)?.at;
    } catch {
      at = undefined;
    }
    if (typeof at !== "number" || !Number.isFinite(at) || now - at > PAGE_EDIT_TEMP_MAX_MS) out.push(key);
  }
  return out;
}

/**
 * Doc ban tam { version, doc }. Chi tra tai lieu khi doc duoc, cung moc phien ban voi to hien tai (ban tam cu khong bao
 * gio de len noi dung vua duoc sua o noi khac) va tai lieu qua duoc phep kiem cua may chu.
 */
export function readPageEditTemp(raw: string | null, version: string): JSONContent | null {
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
  return checkDraftInput(fromEditorDoc(doc as JSONContent)).ok ? (doc as JSONContent) : null;
}

import {
  SHELF_MARK,
  type BlockNode, type DocJson, type InlineNode, type ListItemNode, type Mark, type MarkType, type TextBlockNode,
} from "./types";
import { docCharCount, hasMediaBlock, roughCharCount } from "./text";
import { AUDIO_MAX_MS, IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX } from "@/lib/media/kinds";
import { isMediaNodeType, isPeaks, type MediaNode, type MediaNodeType } from "@/lib/media/node";
import { toStorable } from "@/lib/storable";
import { isUuid } from "@/lib/uuid";

/** Tran cho mot tai lieu: tong so ky tu (moi xuong dong tinh 1), do sau long nhau cua khoi va so khoi media. */
export const DOC_LIMITS = { maxChars: 20_000, maxDepth: 6, maxMedia: 60 } as const;

/**
 * Tran tong cho MOT LAN goi actionPublish, va cung la tran tong cho MOT LUOT o man sua luot - mot luot dung bang mot
 * lan dang, nen hai dau phai dung CHUNG con so nay, khong duoc moi ben mot tran (mot lan dang 25 000 ky tu hop le ma
 * man sua chi cho 20 000 thi luot do khong bao gio sua duoc, ke ca khi chu sach khong doi gi).
 * Khac voi DOC_LIMITS.maxChars, la tran cho TUNG to rieng. actionPublish la diem cuoi cong khai, nhan toi da
 * MAX_SHEETS_PER_PUBLISH (40) to, moi to duoc phep toi DOC_LIMITS.maxChars (20 000) rieng, nen khong co tran tong thi
 * mot lan goi mang toi ~800 000 ky tu vao bang pages.
 *
 * Con so nay KHONG duoc dung lai DOC_LIMITS.maxChars: mot to giay that su (kho co dinh 360x540px, xem
 * src/lib/sheet.ts) o co chu 16px / line-height 1.7 (giay.css) chi chua duoc khoang 500-700 ky tu -
 * nen kich ban hop le day nhat (viet day ca 40 to that su roi dang mot lan) roi vao khoang 20 000-28 000
 * ky tu. Lay dung DOC_LIMITS.maxChars lam tran tong se tu choi ca kich ban hop le do. Chon 100 000: gap
 * khoang 3.5-5 lan kich ban day nhat hop le (du du cho phong chu/man hinh khac nhau) nhung van nho hon
 * 8 lan so muc toi da ly thuyet (800 000) - han che that su kha nang gui payload khong lo, ma khong
 * chan nguoi dung viet that.
 */
export const PUBLISH_TOTAL_MAX_CHARS = 100_000;

/**
 * Tran so to cua mot lan dang, va cua mot luot sau khi sua (luot la dung cac to cua mot lan dang). Dat o day de man
 * sua luot o trinh duyet va may chu doc cung mot so.
 */
export const MAX_SHEETS_PER_PUBLISH = 40;

// Dau doanKe la mot mark that su cua tai lieu, nen no di qua cong kiem nhu ba kieu chu kia: chi tren nut chu, chi cai
// ten, khong thuoc tinh nao theo sau (cleanMarks dung lai dung { type }), va man doc khong ve the nao cho no.
const MARKS = new Set<string>(["bold", "italic", "underline", SHELF_MARK] satisfies MarkType[]);

type Obj = Record<string, unknown>;
type Budget = { chars: number; media: number };

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Kiem mot tai lieu do trinh duyet gui len theo danh sach cho phep, roi dung lai ban sach:
 * chi giu type, content, text, marks va dau noiTiep kieu boolean (xem splitDoc); moi thuoc tinh khac bi bo. Sai bat ky cho nao thi tra null.
 * Ky tu NUL va nua cap surrogate le bi bo (xem toStorable) vi Postgres khong luu duoc chung trong jsonb.
 * Khoi media (anh, ghi am) chi hop le o cap cao nhat va duoc kiem chat hon khoi chu: thieu hay thua thuoc tinh la tu
 * choi ca tai lieu (cleanMedia). Khoi media khong cong ky tu nao vao tran chu, nen duoc dem rieng trong cung budget:
 * qua DOC_LIMITS.maxMedia thi tu choi ca tai lieu.
 */
export function cleanDoc(input: unknown): DocJson | null {
  if (!isObj(input) || input.type !== "doc" || !Array.isArray(input.content) || input.content.length === 0) {
    return null;
  }
  const budget: Budget = { chars: 0, media: 0 };
  const content: BlockNode[] = [];
  for (const node of input.content) {
    let clean: BlockNode | null;
    if (isObj(node) && typeof node.type === "string" && isMediaNodeType(node.type)) {
      budget.media += 1;
      clean = budget.media > DOC_LIMITS.maxMedia ? null : cleanMedia(node.type, node);
    } else {
      clean = cleanBlock(node, 1, budget);
    }
    if (!clean) return null;
    content.push(clean);
  }
  return { type: "doc", content };
}

function cleanBlocks(list: unknown[], depth: number, budget: Budget): TextBlockNode[] | null {
  const out: TextBlockNode[] = [];
  for (const node of list) {
    const clean = cleanBlock(node, depth, budget);
    if (!clean) return null;
    out.push(clean);
  }
  return out;
}

/** Dau noiTiep (xem splitDoc) chi giu khi la boolean (true hay false); gia tri khac bi bo nhu moi thuoc tinh la. */
function tiepCua(node: Obj): { noiTiep?: boolean } {
  return typeof node.noiTiep === "boolean" ? { noiTiep: node.noiTiep } : {};
}

/**
 * Rao do sau dat o DAY, dau ham, vi day la noi duy nhat moi duong de quy cua khoi (kiem qua
 * cleanBlocks lan goi thang tu nhanh bulletList cho muc danh sach) deu phai di qua.
 * Chi nhan khoi chu: khoi media trong trich dan hay muc danh sach roi vao nhanh default va bi tu choi.
 */
function cleanBlock(node: unknown, depth: number, budget: Budget): TextBlockNode | null {
  if (depth > DOC_LIMITS.maxDepth) return null;
  if (!isObj(node)) return null;
  switch (node.type) {
    case "paragraph": {
      const tiep = tiepCua(node);
      if (node.content === undefined) return { type: "paragraph", ...tiep };
      if (!Array.isArray(node.content)) return null;
      const inline = cleanInlines(node.content, budget);
      if (!inline) return null;
      return inline.length > 0 ? { type: "paragraph", ...tiep, content: inline } : { type: "paragraph", ...tiep };
    }
    case "bulletList": {
      if (!Array.isArray(node.content) || node.content.length === 0) return null;
      const items: ListItemNode[] = [];
      for (const item of node.content) {
        if (!isObj(item) || item.type !== "listItem" || !Array.isArray(item.content) || item.content.length !== 1) {
          return null;
        }
        const para = cleanBlock(item.content[0], depth + 1, budget);
        if (!para || para.type !== "paragraph") return null;
        items.push({ type: "listItem", ...tiepCua(item), content: [para] });
      }
      return { type: "bulletList", ...tiepCua(node), content: items };
    }
    case "blockquote": {
      if (!Array.isArray(node.content) || node.content.length === 0) return null;
      const inner = cleanBlocks(node.content, depth + 1, budget);
      return inner ? { type: "blockquote", ...tiepCua(node), content: inner } : null;
    }
    default:
      return null;
  }
}

/** Doi tuong co dung va chi cac khoa nay. */
function hasExactKeys(obj: Obj, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(obj, key));
}

function isIntBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Khoi media nhu trinh duyet gui len: chi co type va attrs, attrs co dung cac khoa cua loai khoi, khong thieu,
 * khong thua. id la uuid; anh co w, h nguyen trong tran cua anh da thu nho; ghi am co ms nguyen toi AUDIO_MAX_MS va dung
 * PEAK_COUNT cot song nguyen tu 0 toi PEAK_MAX. Sai mot cho thi null. Day chi la hinh dang: bindMedia o may chu doi chieu
 * id voi bang media va ghi de thuoc tinh that.
 */
function cleanMedia(type: MediaNodeType, node: Obj): MediaNode | null {
  if (!hasExactKeys(node, ["type", "attrs"]) || !isObj(node.attrs)) return null;
  const { attrs } = node;
  const { id, w, h, ms, peaks } = attrs;
  if (!isUuid(id)) return null;
  if (type === "anh") {
    return hasExactKeys(attrs, ["id", "w", "h"]) && isIntBetween(w, 1, IMAGE_MAX_WIDTH_PX) && isIntBetween(h, 1, IMAGE_MAX_HEIGHT_PX)
      ? { type, attrs: { id, w, h } }
      : null;
  }
  return hasExactKeys(attrs, ["id", "ms", "peaks"]) && isIntBetween(ms, 1, AUDIO_MAX_MS) && isPeaks(peaks)
    ? { type, attrs: { id, ms, peaks: [...peaks] } }
    : null;
}

function cleanInlines(list: unknown[], budget: Budget): InlineNode[] | null {
  const out: InlineNode[] = [];
  for (const node of list) {
    if (!isObj(node)) return null;
    if (node.type === "hardBreak") {
      out.push({ type: "hardBreak" });
      budget.chars += 1;
    } else if (node.type === "text") {
      if (typeof node.text !== "string") return null;
      const text = toStorable(node.text);
      if (text.length === 0) continue;
      const marks = node.marks === undefined ? [] : cleanMarks(node.marks);
      if (!marks) return null;
      out.push(marks.length > 0 ? { type: "text", text, marks } : { type: "text", text });
      budget.chars += text.length;
    } else {
      return null;
    }
    if (budget.chars > DOC_LIMITS.maxChars) return null;
  }
  return out;
}

function cleanMarks(value: unknown): Mark[] | null {
  if (!Array.isArray(value)) return null;
  const out: Mark[] = [];
  for (const mark of value) {
    if (!isObj(mark) || typeof mark.type !== "string" || !MARKS.has(mark.type)) return null;
    if (!out.some((m) => m.type === mark.type)) out.push({ type: mark.type as MarkType });
  }
  return out;
}

/** Ket qua kiem mot ban nhap truoc khi luu: "too-long" phai bao thong diep RIENG voi "invalid". */
export type DraftCheck = { ok: true; doc: DocJson } | { ok: false; reason: "too-long"; chars: number } | { ok: false; reason: "invalid" };

/**
 * Kiem do dai TRUOC khi goi cleanDoc: cleanDoc tu choi ca tai lieu vuot DOC_LIMITS.maxChars va tra ve
 * null giong het loi cau truc, nen goi no truoc se lam mat kha nang bao rieng ly do "qua dai". Dung
 * roughCharCount (uoc luong tren, khong nem voi tai lieu long sau) de bat truong hop nay som.
 */
export function checkDraftInput(input: unknown): DraftCheck {
  const chars = roughCharCount(input);
  if (chars > DOC_LIMITS.maxChars) return { ok: false, reason: "too-long", chars };
  const clean = cleanDoc(input);
  return clean ? { ok: true, doc: clean } : { ok: false, reason: "invalid" };
}

/**
 * Kiem trang tra loi cua trao doi: nhu checkDraftInput, va trang co khoi media la "invalid" (trao doi la viet mot
 * trang chu). Trang tra loi den tay ca hai nguoi qua duong khac man doc, va route /m khong xet seal_replies.
 * actionSubmitReply va checkReply cua trinh duyet cung goi ham nay.
 */
export function checkReplyInput(input: unknown): DraftCheck {
  const checked = checkDraftInput(input);
  return checked.ok && hasMediaBlock(checked.doc) ? { ok: false, reason: "invalid" } : checked;
}

/** Ket qua kiem mang to truoc khi dang: "too-long" la tran TONG, khac tran rieng cua tung to. */
export type PublishCheck =
  | { ok: true; sheets: DocJson[] }
  | { ok: false; reason: "too-long"; chars: number }
  | { ok: false; reason: "invalid" };

/**
 * Kiem cau truc tung to (cleanDoc, tran rieng DOC_LIMITS.maxChars moi to) roi cong tong ca mang, tu choi
 * khi tong vuot cung tran do: actionPublish la diem cuoi cong khai, khong the tin so to va
 * do dai tu trinh duyet gui len khop voi mot ban nhap that su da bi chan o actionSaveDraft.
 */
export function checkPublishInput(sheets: readonly unknown[]): PublishCheck {
  const clean: DocJson[] = [];
  let total = 0;
  for (const sheet of sheets) {
    const c = cleanDoc(sheet);
    if (!c) return { ok: false, reason: "invalid" };
    total += docCharCount(c);
    clean.push(c);
  }
  return total > PUBLISH_TOTAL_MAX_CHARS ? { ok: false, reason: "too-long", chars: total } : { ok: true, sheets: clean };
}

/**
 * Kiem cac to cua mot luot vua sua. Mot luot dung bang mot lan dang, nen luat y het checkPublishInput: tung to qua
 * cleanDoc voi tran rieng DOC_LIMITS.maxChars, tong ca luot qua PUBLISH_TOTAL_MAX_CHARS. Tran rieng thap hon cho luot
 * se tu choi chinh nhung luot da dang hop le (xem chu thich cua PUBLISH_TOTAL_MAX_CHARS). Giu ten rieng vi man sua luot
 * va actionEditRound bao loi bang cau chu cua rieng no.
 */
export function checkRoundInput(sheets: readonly unknown[]): PublishCheck {
  return checkPublishInput(sheets);
}

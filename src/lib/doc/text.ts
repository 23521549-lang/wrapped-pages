import { SHELF_MARK, type BlockNode, type DocJson, type InlineNode } from "./types";
import { isMediaNodeType, type MediaNode, type MediaNodeType } from "@/lib/media/node";
import { sliceWhole } from "@/lib/storable";

function inlineText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === "text" ? n.text : "\n")).join("");
}

/**
 * Cac dong chu cua mot khoi. Moi loai khoi co nhanh rieng, khong nhanh nao doan loai con lai la danh sach: them mot
 * loai khoi ma quen sua o day thi tsc bao ham thieu gia tri tra ve. Khoi media khong co chu.
 */
function blockTexts(block: BlockNode): string[] {
  switch (block.type) {
    case "paragraph":
      return [inlineText(block.content)];
    case "bulletList":
      return block.content.flatMap((item) => item.content.flatMap(blockTexts));
    case "blockquote":
      return block.content.flatMap(blockTexts);
    case "anh":
    case "ghi-am":
      return [];
  }
}

/** Toan bo chu cua tai lieu, moi doan mot dong. */
export function docText(doc: DocJson): string {
  return doc.content.flatMap(blockTexts).join("\n");
}

/** So ky tu cua mot khoi, moi loai khoi mot nhanh nhu blockTexts. Khoi media tinh 0 ky tu. */
function blockCharCount(block: BlockNode): number {
  switch (block.type) {
    case "paragraph":
      return (block.content ?? []).reduce((n, node) => n + (node.type === "hardBreak" ? 1 : node.text.length), 0);
    case "bulletList":
      return block.content.reduce((n, item) => n + item.content.reduce((m, b) => m + blockCharCount(b), 0), 0);
    case "blockquote":
      return block.content.reduce((n, b) => n + blockCharCount(b), 0);
    case "anh":
    case "ghi-am":
      return 0;
  }
}

/**
 * Dem chinh xac so ky tu cua mot tai lieu DA qua cleanDoc, dung cach dem giong het budget cua cleanDoc
 * (moi ky tu text 1, moi hardBreak 1) de cong duoc tong nhieu tai lieu cho cung mot tran DOC_LIMITS.maxChars.
 */
export function docCharCount(doc: DocJson): number {
  return doc.content.reduce((n, b) => n + blockCharCount(b), 0);
}

/**
 * Uoc luong tho so ky tu chu trong mot gia tri JSON CHUA qua kiem (tu trinh duyet gui len), di xuong bat
 * ky cau truc long nhau nao ma khong doi hoi dung dinh dang tai lieu. Dung TRUOC cleanDoc de bao rieng
 * khi vuot tran do dai (muc C): neu goi cleanDoc truoc, tai lieu qua dai bi tu choi chung voi moi loi cau
 * truc khac va nguoi dung khong biet vi sao. Duyet bang ngan xep tuong minh (khong de quy) de mot tai
 * lieu long rat sau khong lam tran ngan xep goi ham; day chi la uoc luong tren, khong phai gia tri
 * cleanDoc se giu lai (ky tu NUL van duoc dem o day, cleanDoc moi la nguoi bo no).
 */
export function roughCharCount(value: unknown): number {
  let total = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (Array.isArray(v)) {
      for (const item of v) stack.push(item);
      continue;
    }
    if (typeof v !== "object" || v === null) continue;
    const obj = v as Record<string, unknown>;
    if (obj.type === "text" && typeof obj.text === "string") total += obj.text.length;
    else if (obj.type === "hardBreak") total += 1;
    else for (const val of Object.values(obj)) stack.push(val);
  }
  return total;
}

/** Doan trich cua to khong co chu nao ma co media: noi to co gi, thay cho mot dong trich rong. */
const MEDIA_EXCERPT = { anh: "Một tấm ảnh.", "ghi-am": "Một đoạn ghi âm." } as const satisfies Record<MediaNodeType, string>;

/** Khoi media dau tien cua tai lieu (media chi nam o cap cao nhat). */
function firstMedia(doc: DocJson): MediaNode | undefined {
  return doc.content.find((block): block is MediaNode => isMediaNodeType(block.type));
}

/** Tai lieu co it nhat mot khoi anh hoac ghi am. */
export function hasMediaBlock(doc: DocJson): boolean {
  return firstMedia(doc) !== undefined;
}

/** Tai lieu khong co chu nao va khong co khoi media nao: chi toan doan trong hoac khoang trang. */
export function isBlankDoc(doc: DocJson): boolean {
  return !hasMediaBlock(doc) && docText(doc).trim() === "";
}

/**
 * Cat mot chuoi da gop khoang trang o ranh gioi tu, toi da max ky tu, them dau ba cham khi bi cat.
 * Khong xe doi emoji o cho cat cung.
 */
export function cutAtWord(flat: string, max: number): string {
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max + 1);
  const space = head.lastIndexOf(" ");
  const cut = space > max * 0.6 ? head.slice(0, space) : sliceWhole(flat, max);
  return `${cut.trimEnd()}…`;
}

/**
 * Moi ky tu ma lop khoang trang cua JavaScript nhan (trim, replace khoang trang cua docExcerpt dung lop nay). SQL chon to
 * cho ke sach dung dung tap nay, nen mot to SQL coi la co chu thi docExcerpt cua no khong bao gio rong (co test).
 */
export const BLANK_CODE_POINTS: readonly number[] = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287,
  12288, 65279,
];

/** Lop ky tu "khong phai khoang trang" cho toan tu ~ cua Postgres; ky tu dat thang vao lop, khong qua chuoi thoat. */
export const NOT_BLANK_PATTERN = `[^${String.fromCharCode(...BLANK_CODE_POINTS)}]`;

/**
 * Gop moi khoang trang lien nhau thanh mot dau cach. Dung dung tap BLANK_CODE_POINTS, tuc tap ma NOT_BLANK_PATTERN
 * (cau SQL chon to cua ke sach) coi la "khong co chu", nen chu SQL bo di va chu cac ham o day giu lai khong bao gio
 * lech nhau.
 */
const KHOANG_TRANG = new RegExp(`[${String.fromCharCode(...BLANK_CODE_POINTS)}]+`, "g");

/**
 * Doan trich ngan cho the sach: gop khoang trang, cat o ranh gioi tu, them dau ba cham. Tai lieu khong co chu ma co
 * media thi la nhan cua khoi media dau tien. sealTeaser khong dung ham nay, nen to khoa khong bao gio goi y co media.
 */
export function docExcerpt(doc: DocJson, max = 140): string {
  const chu = docText(doc);
  const media = chu.trim() === "" ? firstMedia(doc) : undefined;
  if (media) return MEDIA_EXCERPT[media.type];
  return cutAtWord(chu.replace(KHOANG_TRANG, " ").trim(), max);
}

/** Chu cua mot nut inline neu no mang dau doanKe; nut khong mang dau (va moi xuong dong) khong gop chu nao. */
function markedText(node: InlineNode): string {
  return node.type === "text" && (node.marks ?? []).some((m) => m.type === SHELF_MARK) ? node.text : "";
}

/**
 * Chu MANG DAU doanKe cua mot khoi, moi doan mot dong. Moi loai khoi mot nhanh nhu blockTexts; khoi media khong co chu.
 */
function blockMarkedTexts(block: BlockNode): string[] {
  switch (block.type) {
    case "paragraph":
      return [(block.content ?? []).map(markedText).join("")];
    case "bulletList":
      return block.content.flatMap((item) => item.content.flatMap(blockMarkedTexts));
    case "blockquote":
      return block.content.flatMap(blockMarkedTexts);
    case "anh":
    case "ghi-am":
      return [];
  }
}

/**
 * Doan nguoi viet da chon lam doan tren ke trong mot to: chu cua cac nut mang dau doanKe, gop khoang trang roi cat o
 * ranh gioi tu nhu docExcerpt. Khong co dau, hay chu mang dau chi toan khoang trang, thi null - khi do khung sach lui
 * ve cach chon con lai (bat tham tat dinh theo ngay).
 */
export function markedExcerpt(doc: DocJson, max = 140): string | null {
  const chu = doc.content.flatMap(blockMarkedTexts).join(" ").replace(KHOANG_TRANG, " ").trim();
  return chu === "" ? null : cutAtWord(chu, max);
}

/** Bo cac tai lieu trong o cuoi danh sach, vi du cac to chi con doan trong sau khi cat trang. */
export function trimTrailingBlank(docs: readonly DocJson[]): DocJson[] {
  let end = docs.length;
  while (end > 0 && isBlankDoc(docs[end - 1])) end--;
  return docs.slice(0, end);
}

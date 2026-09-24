import { isStorable } from "@/lib/storable";
import { isUuid } from "@/lib/uuid";
import { parseYoutubeLink } from "@/lib/youtube";

export const COVERS = [
  "nui-xa", "khom-truc", "trang-nuoc", "chim-bay", "hoa-dao", "doi-chim", "thuyen-trang", "cau-go", "doi-thong", "meo-mai",
] as const;
export type CoverKey = (typeof COVERS)[number];

export const MODES = ["chia-se", "rieng-tu"] as const;
export type BookMode = (typeof MODES)[number];

export const TITLE_MAX = 60;

/**
 * youtubeId bat buoc co mat (null la khong co nhac): bo sot truong nay khi sua sach se lang le giu nhac cu.
 * coverMediaId bat buoc vi cung ly do: null la khong co bia tu tai len, sach dung tranh ve san cover.
 */
export type BookInput = { title: string; mode: BookMode; cover: CoverKey; youtubeId: string | null; coverMediaId: string | null };

/** Hai truong con doi duoc o man Sua sach. Bia va nhac da roi xuong hai muc dong thoi gian (phan quyet B2). */
export type BookSettings = { title: string; mode: BookMode };

const TEN_SAI = `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.`;
const BIA_SAI = "Chọn một bìa cho cuốn sách.";
const CHE_DO_SAI = "Chọn một chế độ cho cuốn sách.";

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Ten sach da gom moi khoang trang thua ve mot dau cach; null la ten khong dung duoc. */
function parseTitle(raw: string): string | null {
  const ten = raw.trim().replace(/\s+/g, " ");
  return ten.length < 1 || ten.length > TITLE_MAX || !isStorable(ten) ? null : ten;
}

/**
 * Bo luat chung cua bon truong, nhan chuoi tho. Chi form sach di qua day; muc gap o buoc dang khong con (spec).
 */
function parseFields(title: string, cover: unknown, coverMedia: string, music: string): Omit<BookInput, "mode"> | { error: string } {
  const ten = parseTitle(title);
  if (ten === null) return { error: TEN_SAI };
  if (!isOneOf(COVERS, cover)) return { error: BIA_SAI };
  // Bia tu tai len: id media dang uuid hoac bo trong. Quyen tren media do duoc kiem o createBook, updateBook va publishDraft.
  if (coverMedia !== "" && !isUuid(coverMedia)) return { error: BIA_SAI };
  const nhac = parseYoutubeLink(music);
  if (!nhac.ok) return { error: nhac.error };
  return { title: ten, cover, youtubeId: nhac.id, coverMediaId: coverMedia === "" ? null : coverMedia };
}

/** Kiem form tao sach. Thong diep loi hien thang cho nguoi dung. */
export function parseBookInput(fd: FormData): BookInput | { error: string } {
  const mode = fd.get("mode");
  if (!isOneOf(MODES, mode)) return { error: CHE_DO_SAI };
  const chung = parseFields(String(fd.get("title") ?? ""), fd.get("cover"), String(fd.get("coverMedia") ?? ""), String(fd.get("music") ?? ""));
  return "error" in chung ? chung : { ...chung, mode };
}

/** Kiem form Sua sach: form nay khong gui bia hay nhac nua, va moi truong thua deu bi bo qua. */
export function parseBookSettings(fd: FormData): BookSettings | { error: string } {
  const mode = fd.get("mode");
  if (!isOneOf(MODES, mode)) return { error: CHE_DO_SAI };
  const ten = parseTitle(String(fd.get("title") ?? ""));
  return ten === null ? { error: TEN_SAI } : { title: ten, mode };
}

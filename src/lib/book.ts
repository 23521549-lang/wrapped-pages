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

/**
 * Bon truong doi duoc ca o form sach lan o muc "Doi bia, ten, nhac" cua buoc dang trang. Che do chia se hay rieng tu
 * KHONG o day: doi che do co he qua rieng tu rieng, chi form sach moi lam duoc.
 */
export type BookEdit = Omit<BookInput, "mode">;

const TEN_SAI = `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.`;
const BIA_SAI = "Chọn một bìa cho cuốn sách.";
const KHONG_DOC_DUOC = "Chưa đổi được tên, bìa hay nhạc. Thử lại nhé.";

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Bo luat chung cua bon truong, nhan chuoi tho: FormData cua form sach va doi tuong tu buoc dang deu quy ve day, nen
 * hai duong khong the lech luat hay lech cau loi.
 */
function parseFields(title: string, cover: unknown, coverMedia: string, music: string): BookEdit | { error: string } {
  const ten = title.trim().replace(/\s+/g, " ");
  if (ten.length < 1 || ten.length > TITLE_MAX || !isStorable(ten)) return { error: TEN_SAI };
  if (!isOneOf(COVERS, cover)) return { error: BIA_SAI };
  // Bia tu tai len: id media dang uuid hoac bo trong. Quyen tren media do duoc kiem o createBook, updateBook va publishDraft.
  if (coverMedia !== "" && !isUuid(coverMedia)) return { error: BIA_SAI };
  const nhac = parseYoutubeLink(music);
  if (!nhac.ok) return { error: nhac.error };
  return { title: ten, cover, youtubeId: nhac.id, coverMediaId: coverMedia === "" ? null : coverMedia };
}

/** Kiem form tao hoac sua sach. Thong diep loi hien thang cho nguoi dung. */
export function parseBookInput(fd: FormData): BookInput | { error: string } {
  const mode = fd.get("mode");
  if (!isOneOf(MODES, mode)) return { error: "Chọn một chế độ cho cuốn sách." };
  const chung = parseFields(String(fd.get("title") ?? ""), fd.get("cover"), String(fd.get("coverMedia") ?? ""), String(fd.get("music") ?? ""));
  return "error" in chung ? chung : { ...chung, mode };
}

/**
 * Kiem muc "Doi bia, ten, nhac" cua buoc dang trang. Gia tri den thang tu trinh duyet (khong qua FormData) nen tung
 * truong phai la chuoi truoc khi vao bo luat chung; khong co che do sach.
 */
export function parseBookEdit(value: unknown): BookEdit | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { error: KHONG_DOC_DUOC };
  const { title, cover, coverMedia, music } = value as Record<string, unknown>;
  if (typeof title !== "string" || typeof coverMedia !== "string" || typeof music !== "string") return { error: KHONG_DOC_DUOC };
  return parseFields(title, cover, coverMedia, music);
}

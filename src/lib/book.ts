import { isStorable } from "@/lib/storable";
import { isUuid } from "@/lib/uuid";
import { parseYoutubeLink } from "@/lib/youtube";

export const COVERS = ["nui-xa", "khom-truc", "trang-nuoc", "chim-bay"] as const;
export type CoverKey = (typeof COVERS)[number];

export const MODES = ["chia-se", "rieng-tu"] as const;
export type BookMode = (typeof MODES)[number];

export const TITLE_MAX = 60;

/**
 * youtubeId bat buoc co mat (null la khong co nhac): bo sot truong nay khi sua sach se lang le giu nhac cu.
 * coverMediaId bat buoc vi cung ly do: null la khong co bia tu tai len, sach dung tranh ve san cover.
 */
export type BookInput = { title: string; mode: BookMode; cover: CoverKey; youtubeId: string | null; coverMediaId: string | null };

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Kiem form tao hoac sua sach. Thong diep loi hien thang cho nguoi dung. */
export function parseBookInput(fd: FormData): BookInput | { error: string } {
  const title = String(fd.get("title") ?? "").trim().replace(/\s+/g, " ");
  const mode = fd.get("mode");
  const cover = fd.get("cover");
  if (title.length < 1 || title.length > TITLE_MAX || !isStorable(title)) return { error: `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.` };
  if (!isOneOf(MODES, mode)) return { error: "Chọn một chế độ cho cuốn sách." };
  if (!isOneOf(COVERS, cover)) return { error: "Chọn một bìa cho cuốn sách." };
  // Bia tu tai len: id media dang uuid hoac bo trong. Quyen tren media do duoc kiem o createBook va updateBook.
  const coverMedia = String(fd.get("coverMedia") ?? "");
  if (coverMedia !== "" && !isUuid(coverMedia)) return { error: "Chọn một bìa cho cuốn sách." };
  const music = parseYoutubeLink(String(fd.get("music") ?? ""));
  if (!music.ok) return { error: music.error };
  return { title, mode, cover, youtubeId: music.id, coverMediaId: coverMedia === "" ? null : coverMedia };
}

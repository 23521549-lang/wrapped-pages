import { isStorable } from "@/lib/storable";
import { isUuid } from "@/lib/uuid";
import { parseYoutubeLink } from "@/lib/youtube";

export const COVERS = [
  "nui-xa", "khom-truc", "trang-nuoc", "chim-bay", "hoa-dao", "doi-chim", "thuyen-trang", "cau-go", "doi-thong", "meo-mai",
] as const;
export type CoverKey = (typeof COVERS)[number];

/**
 * Ten tranh ve cua tung bia, dung giua cau. Du lieu thuan nen o day chu khong o tep ve: cau tinh o buoc dang can no, ma
 * src/lib khong duoc nhap @/components.
 */
export const COVER_NAME: Record<CoverKey, string> = {
  "nui-xa": "Núi xa",
  "khom-truc": "Khóm trúc",
  "trang-nuoc": "Trăng trên nước",
  "chim-bay": "Chim bay qua bờ nước",
  "hoa-dao": "Cành hoa đào",
  "doi-chim": "Đôi chim sẻ trên cành",
  "thuyen-trang": "Thuyền nhỏ dưới trăng",
  "cau-go": "Cầu gỗ qua suối",
  "doi-thong": "Đồi thông trong sương",
  "meo-mai": "Mèo ngủ trên mái ngói",
};

/** Nhan cho nguoi dung trinh doc man hinh, dung o bo chon bia: chu Bia kem ten tranh viet thuong. */
export const COVER_LABEL = Object.fromEntries(COVERS.map((c) => [c, `Bìa ${COVER_NAME[c].toLowerCase()}`])) as Record<CoverKey, string>;

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

/** Hai o ma nguoi viet chon cho luot sap dang. cover null la luot nay khong them o bia nao. */
export type TrimInput = { cover: CoverKey | null; coverMediaId: string | null; youtubeId: string | null; dropTrack: boolean };

const GO_NHAC_SAI = "Bỏ dấu gỡ nhạc nếu bạn muốn dán một bản nhạc mới.";

/**
 * Kiem bieu mau cua trang Viet tiep. Khac parseBookInput o cho ca hai o deu bo trong duoc: bo trong nghia la luot nay
 * khong them o nao va cuon giu nguyen bia voi nhac dang co. Anh bia van phai di kem mot tranh du phong, dung luat cua
 * CHECK drafts_cover_media, nen giao dien khong bao gio gui mot gia tri ma may chu se tu choi.
 */
export function parseTrimInput(fd: FormData): TrimInput | { error: string } {
  const raw = String(fd.get("cover") ?? "");
  const coverMedia = String(fd.get("coverMedia") ?? "");
  const dropTrack = fd.get("dropTrack") !== null;
  if (raw !== "" && !isOneOf(COVERS, raw)) return { error: BIA_SAI };
  const cover = raw === "" ? null : raw;
  if (coverMedia !== "" && (cover === null || !isUuid(coverMedia))) return { error: BIA_SAI };
  const nhac = parseYoutubeLink(String(fd.get("music") ?? ""));
  if (!nhac.ok) return { error: nhac.error };
  if (dropTrack && nhac.id !== null) return { error: GO_NHAC_SAI };
  return { cover, coverMediaId: coverMedia === "" ? null : coverMedia, youtubeId: nhac.id, dropTrack };
}

/**
 * Cau chi doc o buoc dang, noi gon mot dong luot sap dang se them gi. Thay cho muc gap "Doi bia, ten, nhac" da bo:
 * buoc dang chi bao lai lua chon, con doi thi o trang Viet tiep.
 */
export function cauOLuot(trim: TrimInput): string {
  const bia = trim.cover === null ? null : trim.coverMediaId !== null ? "Ảnh của bạn" : COVER_NAME[trim.cover];
  const nhac = trim.dropTrack ? "gỡ nhạc nền" : trim.youtubeId !== null ? "thêm nhạc nền" : null;
  if (bia === null && nhac === null) return "Lượt này không thêm bìa hay nhạc.";
  if (bia === null) return `Lượt này ${nhac}.`;
  if (nhac === null) return `Lượt này thêm bìa ${bia}.`;
  return `Lượt này thêm bìa ${bia} và ${nhac === "thêm nhạc nền" ? "nhạc nền" : nhac}.`;
}

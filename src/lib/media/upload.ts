import {
  AUDIO_MAX_MS, COVER_RATIO, IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX, MEDIA_KINDS, MEDIA_MAX_BYTES, PEAK_COUNT,
  type AudioMime, type ImageMime, type MediaKind,
} from "./kinds";
import { isPeaks } from "./node";
import { sniffMedia } from "./sniff";
import { isUuid } from "@/lib/uuid";

/** Thong diep loi cua tai len, hien thang cho nguoi dung. */
export const UPLOAD_ERRORS = {
  invalid: "Tệp tải lên không đọc được.",
  tooLarge: "Tệp lớn quá, chọn tệp khác.",
  // Tran tong MEDIA_TOTAL_MAX_BYTES tinh ca anh, ghi am va bia, nen cau bao cung phai noi ca ba.
  full: "Kho ảnh và ghi âm đã gần đầy.",
} as const;

/** Mot tep tai len da kiem: loai, cuon, mime va kich thuoc that doc tu byte; thoi luong va song am cua ghi am. */
export type CheckedUpload =
  | { kind: "anh"; bookId: string; mime: ImageMime; bytes: number; width: number; height: number }
  | { kind: "bia"; bookId: string | null; mime: ImageMime; bytes: number; width: number; height: number }
  | { kind: "ghi-am"; bookId: string; mime: AudioMime; bytes: number; durationMs: number; peaks: number[] };

export type ParsedUpload = { upload: CheckedUpload; body: Uint8Array<ArrayBuffer> };

/** Thoi luong tu form: so nguyen duong viet bang chu so, khong dau, khong so mu. */
const DURATION = /^[1-9][0-9]*$/;
/** Chuoi song am dai nhat duoc doc: PEAK_COUNT cot, moi cot toi da 3 chu so, mot dau phay, du cho khoang trang. */
const PEAKS_MAX_CHARS = PEAK_COUNT * 8;

const invalid = () => ({ error: UPLOAD_ERRORS.invalid });

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

function parseDuration(value: FormDataEntryValue | null): number | null {
  return typeof value === "string" && DURATION.test(value) && Number(value) <= AUDIO_MAX_MS ? Number(value) : null;
}

function parsePeaks(value: FormDataEntryValue | null): number[] | null {
  if (typeof value !== "string" || value.length > PEAKS_MAX_CHARS) return null;
  try {
    const peaks: unknown = JSON.parse(value);
    return isPeaks(peaks) ? peaks : null;
  } catch {
    return null;
  }
}

/**
 * Kiem form tai len cua actionUploadMedia. Truong: kind (anh, ghi-am, bia), file, book (uuid cua cuon; bia luc
 * tao sach thi bo trong), ms va peaks (chi ghi am; peaks la JSON mot mang song am tinh luc ghi). Khong tin mime, ten hay
 * kich thuoc cua trinh duyet: tran byte theo loai kiem truoc khi doc tep, roi sniffMedia doc mime va kich thuoc that.
 * Anh va bia phai la anh, ghi am phai la am thanh (mime thuoc MEDIA_MIMES cua loai); anh nam trong tran IMAGE_MAX_*, bia
 * dung ti le COVER_RATIO. Vuot tran byte la tooLarge, moi loi khac la invalid. Quyen tren cuon do may chu kiem sau.
 */
export async function parseUploadForm(fd: FormData): Promise<ParsedUpload | { error: string }> {
  const kind = fd.get("kind");
  const file = fd.get("file");
  const book = fd.get("book");
  if (!isMediaKind(kind) || !(file instanceof File)) return invalid();
  if (file.size > MEDIA_MAX_BYTES[kind]) return { error: UPLOAD_ERRORS.tooLarge };
  const body = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(body);
  if (!sniffed) return invalid();
  const bytes = body.length;
  if (kind === "ghi-am") {
    const durationMs = parseDuration(fd.get("ms"));
    const peaks = parsePeaks(fd.get("peaks"));
    if ("width" in sniffed || !isUuid(book) || durationMs === null || peaks === null) return invalid();
    return { upload: { kind, bookId: book, mime: sniffed.mime, bytes, durationMs, peaks }, body };
  }
  if (!("width" in sniffed) || sniffed.width > IMAGE_MAX_WIDTH_PX || sniffed.height > IMAGE_MAX_HEIGHT_PX) return invalid();
  const { mime, width, height } = sniffed;
  if (kind === "anh") return isUuid(book) ? { upload: { kind, bookId: book, mime, bytes, width, height }, body } : invalid();
  const bookId = isUuid(book) ? book : null;
  if ((bookId === null && book !== null && book !== "") || width * COVER_RATIO.height !== height * COVER_RATIO.width) return invalid();
  return { upload: { kind, bookId, mime, bytes, width, height }, body };
}

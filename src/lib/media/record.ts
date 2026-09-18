import { AUDIO_MAX_MS } from "./kinds";

/** Dinh dang ghi theo thu tu uu tien: WebM/Opus truoc, MP4 cho Safari. May chu nhan audio/webm va audio/mp4. */
export const RECORDER_MIMES = ["audio/webm;codecs=opus", "audio/mp4;codecs=opus", "audio/mp4"] as const;

/** Dinh dang dau tien trinh duyet ghi duoc; null la trinh duyet khong ghi duoc dinh dang nao may chu nhan. */
export function pickRecorderMime(isTypeSupported: (mime: string) => boolean): string | null {
  return RECORDER_MIMES.find((mime) => isTypeSupported(mime)) ?? null;
}

/** Huy khi da ghi tu moc nay tro len thi hoi lai trong hop. */
export const CANCEL_ASK_MS = 5_000;
/** Tu moc nay dong trang thai bao con 10 giay. */
export const NEAR_END_MS = AUDIO_MAX_MS - 10_000;

export type MicProblem = "not-allowed" | "not-found";

/** Loi micro tach hai cau. */
export const MIC_ERRORS = {
  "not-allowed": "Chưa cho phép dùng micro.",
  "not-found": "Không tìm thấy micro.",
} as const satisfies Record<MicProblem, string>;

/**
 * Loi cua getUserMedia thanh mot trong hai cau: NotAllowedError, SecurityError la chua cho phep. Moi loi con lai
 * (NotFoundError, OverconstrainedError, micro dang bi chiem, trinh duyet khong ghi duoc) deu la khong co micro dung duoc.
 */
export function micProblem(error: unknown): MicProblem {
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : null;
  return name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : "not-found";
}

/** Dong trang thai luc dang ghi: tu NEAR_END_MS bao con 10 giay. */
export function recordingStatus(elapsedMs: number): string {
  return elapsedMs >= NEAR_END_MS ? "Còn 10 giây" : "Đang ghi";
}

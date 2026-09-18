export const SEAL_MAX_FAILS = 5;
export const SEAL_COOLDOWN_MS = 10 * 60 * 1000;
export const HINT_EVERY = 2;

export type AttemptState = {
  /** So goi y da mo, khong vuot so goi y nguoi viet da soan. */
  hintsUnlocked: number;
  /** So lan con duoc thu truoc khi phai cho; 0 khi dang trong khoang cho. */
  remaining: number;
  /** Dang trong khoang cho thi la moc het cho, khong thi null. */
  lockedUntil: Date | null;
};

/**
 * Trang thai thu dap an cua mot nguoi voi mot niem phong, tinh tu moc cua moi lan sai.
 * Sai 2, 4, 6 lan thi mo goi y 1, 2, 3. Moi lan sai thu 5, 10, 15... bat dau mot khoang cho 10 phut
 * tinh tu luc cua chinh lan sai do. failTimes phai theo thu tu tang dan.
 */
export function attemptState(failTimes: readonly Date[], hintCount: number, now: Date): AttemptState {
  const w = failTimes.length;
  const hintsUnlocked = Math.min(hintCount, Math.floor(w / HINT_EVERY));
  if (w > 0 && w % SEAL_MAX_FAILS === 0) {
    const lockedUntil = new Date(failTimes[w - 1].getTime() + SEAL_COOLDOWN_MS);
    if (now.getTime() < lockedUntil.getTime()) return { hintsUnlocked, remaining: 0, lockedUntil };
    return { hintsUnlocked, remaining: SEAL_MAX_FAILS, lockedUntil: null };
  }
  return { hintsUnlocked, remaining: SEAL_MAX_FAILS - (w % SEAL_MAX_FAILS), lockedUntil: null };
}

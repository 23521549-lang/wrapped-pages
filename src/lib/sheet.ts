/** Hinh hoc to giay, don vi px logic. Nguon duy nhat cho bo xep trang; tokens.css phai khop (co test). */
export const SHEET = {
  width: 360,
  height: 540,
  padTop: 36,
  padRight: 28,
  padBottom: 44,
  padLeft: 28,
  /** Khe giua hai to xep chong o man viet. */
  gap: 28,
} as const;

export const CONTENT_WIDTH = SHEET.width - SHEET.padLeft - SHEET.padRight;
export const CONTENT_HEIGHT = SHEET.height - SHEET.padTop - SHEET.padBottom;

/**
 * Chieu cao co dinh cua khoi ghi am trong vung chu, px logic. Token --khoi-ghi-am-h cua tokens.css phai
 * khop (co test). 72 chu khong 64: nut phat cao tron khoi, thanh song va nut Bo ghi am can du cho.
 */
export const VOICE_BLOCK_HEIGHT = 72;

/**
 * Chieu cao khoi dem chen o cho ngat trang trong man viet: day phan con lai qua het vung chu,
 * padding duoi, khe giua hai to va padding tren cua to sau.
 */
export function spacerHeight(spaceLeft: number): number {
  return Math.max(0, spaceLeft) + SHEET.padBottom + SHEET.gap + SHEET.padTop;
}

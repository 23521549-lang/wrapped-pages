/** Moi cot chiem WAVE_STEP don vi ngang trong viewBox; viewBox cao WAVE_HEIGHT. */
export const WAVE_STEP = 4;
export const WAVE_HEIGHT = 100;

const BE_RONG_COT = 2.6;
/** Cot lang van cao chung nay, de doan im van thay nhip. */
const COT_THAP_NHAT = 4;

export type WaveBar = { x: number; y: number; width: number; height: number };

/**
 * Cac cot cua mot day muc am tu 0 toi max, canh giua theo chieu doc, cho SVG co viewBox rong values.length * WAVE_STEP
 * va cao WAVE_HEIGHT. Hinh ve bang thuoc tinh cua rect, khong can style. Dung chung cho song am cua khoi ghi am
 * (peaks tu 0 toi PEAK_MAX) va thanh muc am luc dang ghi.
 */
export function waveBars(values: readonly number[], max: number): WaveBar[] {
  return values.map((value, i) => {
    const height = COT_THAP_NHAT + (Math.min(max, Math.max(0, value)) / max) * (WAVE_HEIGHT - COT_THAP_NHAT);
    return { x: i * WAVE_STEP + (WAVE_STEP - BE_RONG_COT) / 2, y: (WAVE_HEIGHT - height) / 2, width: BE_RONG_COT, height };
  });
}

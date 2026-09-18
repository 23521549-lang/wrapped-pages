import { PEAK_COUNT, PEAK_MAX } from "./kinds";

/** Gia tri mau cua su im lang trong getByteTimeDomainData: song am dao dong quanh 128. */
const IM_LANG = 128;

/** Muc am cua mot khung mau thoi gian lay tu AnalyserNode.getByteTimeDomainData: RMS tu 0 (im) toi 1. */
export function levelOf(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) {
    const v = (s - IM_LANG) / IM_LANG;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length));
}

/**
 * Song am PEAK_COUNT cot tu cac muc am do trong luc ghi, khong can giai ma lai tep (Safari khong giai ma duoc WebM).
 * Chia deu day muc thanh PEAK_COUNT doan, moi cot la muc lon nhat cua doan, roi chuan hoa theo cot cao nhat ve so nguyen tu
 * 0 toi PEAK_MAX. Day ngan hon PEAK_COUNT thi moi muc trai ra nhieu cot. Khong co muc nao hoac im lang hoan toan thi toan 0.
 */
export function peaksFromLevels(levels: readonly number[]): number[] {
  const cot = Array.from({ length: PEAK_COUNT }, (_, i) => {
    const from = Math.floor((i * levels.length) / PEAK_COUNT);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / PEAK_COUNT));
    return levels.slice(from, to).reduce((max, v) => Math.max(max, v), 0);
  });
  const cao = cot.reduce((max, v) => Math.max(max, v), 0);
  return cot.map((v) => (cao > 0 ? Math.round((v / cao) * PEAK_MAX) : 0));
}

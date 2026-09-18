const CHU = new Intl.Segmenter("vi", { granularity: "grapheme" });

/** Chu cai dau cua mot biet danh, viet hoa, cho o tron dai dien. Tach theo grapheme de khong cat roi dau. */
export function initialOf(name: string): string {
  for (const { segment } of CHU.segment(name.trim())) return segment.toLocaleUpperCase("vi");
  return "";
}

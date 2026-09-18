/** Ket qua doc header Range: ca tep, mot khoang byte (end tinh ca), hoac khoang khong dap ung duoc. */
export type RangeResult = { status: 200 } | { status: 206; start: number; end: number } | { status: 416 };

const BYTES_RANGE = /^bytes=([0-9]*)-([0-9]*)$/i;

/**
 * Doc header Range cho mot tep size byte (RFC 9110 muc 14). Chi ho tro mot khoang. Khong co header, sai cu phap
 * hay nhieu khoang thi tra ca tep (200), vi may chu duoc phep bo qua Range. Khoang dung cu phap nhung bat dau tu
 * cuoi tep tro di, hoac hau to 0 byte, thi 416. Cuoi vuot tep thi kep ve byte cuoi.
 */
export function parseRange(header: string | null, size: number): RangeResult {
  const match = header === null ? null : BYTES_RANGE.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return { status: 200 };
  const [, first, last] = match;
  if (first === "") return suffixRange(Number(last), size);
  const start = Number(first);
  if (last !== "" && Number(last) < start) return { status: 200 };
  if (start >= size) return { status: 416 };
  return { status: 206, start, end: last === "" ? size - 1 : Math.min(Number(last), size - 1) };
}

/** Hau to bytes=-n: n byte cuoi, ca tep khi n lon hon tep. */
function suffixRange(length: number, size: number): RangeResult {
  if (length === 0 || size === 0) return { status: 416 };
  return { status: 206, start: Math.max(0, size - length), end: size - 1 };
}

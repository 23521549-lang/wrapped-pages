import type { DocJson } from "@/lib/doc/types";
import { cutAtWord, docText } from "@/lib/doc/text";
import { SEAL_LIMITS } from "./types";

/**
 * Dong he lo cua mot lan dang bi niem phong: dong co chu dau tien cua to dau, gop khoang
 * trang, cat o ranh gioi tu toi da SEAL_LIMITS.teaserMax ky tu. Chi may chu goi ham nay; chu that con
 * lai cua to khong bao gio duoc gui xuong trinh duyet. To khong co chu nao thi tra chuoi rong.
 */
export function sealTeaser(doc: DocJson): string {
  const first = docText(doc)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line !== "");
  return first ? cutAtWord(first, SEAL_LIMITS.teaserMax) : "";
}

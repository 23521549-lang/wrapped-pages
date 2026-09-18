import { CONTENT_HEIGHT, CONTENT_WIDTH, VOICE_BLOCK_HEIGHT } from "@/lib/sheet";
import type { ImageAttrs, MediaNode } from "./node";

/**
 * Hop hien cua mot anh trong vung chu, px logic, tinh tu attrs nen khong can tai anh. Anh hep hon vung chu giu
 * dung co that, khong phong to; rong hon thi co ve CONTENT_WIDTH. Cao theo ti le, lam tron, it nhat 1 va khong bao gio
 * cao hon CONTENT_HEIGHT; anh doc cham tran thi ve vua hop bang object-fit contain.
 */
export function imageBox({ w, h }: Pick<ImageAttrs, "w" | "h">): { width: number; height: number } {
  const width = Math.min(w, CONTENT_WIDTH);
  return { width, height: Math.min(CONTENT_HEIGHT, Math.max(1, Math.round((width * h) / w))) };
}

/**
 * Chieu cao cua mot khoi media trong vung chu, px logic, tinh tu attrs: anh theo imageBox, ghi am cao co dinh
 * VOICE_BLOCK_HEIGHT. Khoi nguyen luon vua mot to. Bo do, man viet va man doc cung dung ham nay.
 */
export function mediaBlockHeight(node: MediaNode): number {
  return node.type === "ghi-am" ? VOICE_BLOCK_HEIGHT : imageBox(node.attrs).height;
}

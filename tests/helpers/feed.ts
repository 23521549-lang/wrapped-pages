import type { FeedItem } from "@/lib/feed/types";

/** Gia tri mac dinh cua cac truong dot nam cua mot dong Hoat dong mau: chua co gi moi, khong chi tiet, khong tam trang. */
export const DONG_MAC_DINH = {
  isNew: false, detail: null, weather: null, biaMoi: false, nhacMoi: false, ordinal: null, tenLuot: null,
} as const satisfies Partial<FeedItem>;

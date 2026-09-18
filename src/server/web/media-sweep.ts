import "server-only";
import { after } from "next/server";
import { db } from "@/server/db";
import { getMediaStore } from "@/server/media/get-store";
import { sweepMedia } from "@/server/media/sweep";

/**
 * Hen don rac media sau khi phan hoi da gui, goi tu action dang trang, sua sach va tai len. sweepMedia tu chan tan
 * suat bang moc trong database, nen du moi action deu goi, ca web chi don nhieu nhat mot lan moi MEDIA_SWEEP_INTERVAL_MS.
 * Kho duoc chon ben trong after(): kho tat thi khong lam gi, cau hinh kho hong khong lam hong hanh dong chinh.
 */
export function sweepMediaAfterResponse(): void {
  after(async () => {
    const store = getMediaStore();
    if (store) await sweepMedia(db, store, new Date());
  });
}

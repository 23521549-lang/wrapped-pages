import { dayKey, dayLabel } from "@/lib/when";
import type { FeedItem } from "./types";

/** Mot nhom ngay cua khung Hoat dong: khoa ngay lich, nhan dau nhom va cac dong cua ngay do. */
export type FeedDay = { key: string; label: string; items: FeedItem[] };

/**
 * Chia dong Hoat dong theo ngay lich Viet Nam. Ngay xuat hien truoc dung truoc, trong mot ngay giu nguyen thu tu
 * cua items (listActivity da xep moi nhat truoc), nen moi ngay chi co mot nhom du items co xen ke.
 */
export function feedDays(items: readonly FeedItem[], now: Date): FeedDay[] {
  const days = new Map<string, FeedDay>();
  for (const item of items) {
    const key = dayKey(item.at);
    const day = days.get(key);
    if (day) day.items.push(item);
    else days.set(key, { key, label: dayLabel(item.at, now), items: [item] });
  }
  return [...days.values()];
}

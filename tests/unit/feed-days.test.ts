import { describe, it, expect } from "vitest";
import { feedDays } from "@/lib/feed/days";
import type { FeedItem } from "@/lib/feed/types";

const NOW = new Date("2026-09-15T15:00:00+07:00");
let dem = 0;

/** Mot dong mau luc iso; moi dong mot id rieng. */
function dong(iso: string): FeedItem {
  dem += 1;
  return {
    id: `su-kien-${dem}`, kind: "dang-trang", by: "partner", at: new Date(iso),
    bookId: "11111111-1111-4111-8111-111111111111", bookTitle: "Chuyện chưa kể", firstPosition: 1, lastPosition: 1,
    sealKind: null, note: null, count: 1,
  };
}

describe("feedDays", () => {
  it("khong co dong nao thi khong co nhom nao", () => {
    expect(feedDays([], NOW)).toEqual([]);
  });

  it("moi ngay lich Viet Nam mot nhom, dung thu tu, nhan Hom nay, Hom qua, ngay thang", () => {
    const items = [
      dong("2026-09-15T14:00:00+07:00"),
      dong("2026-09-15T00:05:00+07:00"),
      dong("2026-09-14T23:55:00+07:00"),
      dong("2026-09-04T21:02:00+07:00"),
    ];
    const days = feedDays(items, NOW);
    expect(days.map((d) => [d.key, d.label, d.items.map((i) => i.id)])).toEqual([
      ["2026-09-15", "Hôm nay", [items[0].id, items[1].id]],
      ["2026-09-14", "Hôm qua", [items[2].id]],
      ["2026-09-04", "04.09", [items[3].id]],
    ]);
  });

  it("chia theo gio Viet Nam, khong theo ngay UTC", () => {
    const days = feedDays([dong("2026-09-14T17:30:00Z"), dong("2026-09-14T16:30:00Z")], NOW);
    expect(days.map((d) => d.label)).toEqual(["Hôm nay", "Hôm qua"]);
  });

  it("dong cung ngay xen ke van vao mot nhom duy nhat, giu thu tu trong nhom", () => {
    const items = [dong("2026-09-15T09:00:00+07:00"), dong("2026-09-14T09:00:00+07:00"), dong("2026-09-15T08:00:00+07:00")];
    expect(feedDays(items, NOW).map((d) => d.items.map((i) => i.id))).toEqual([[items[0].id, items[2].id], [items[1].id]]);
  });
});

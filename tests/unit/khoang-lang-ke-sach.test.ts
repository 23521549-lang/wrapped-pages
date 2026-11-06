import { describe, expect, it } from "vitest";
import { listShelf } from "@/server/library/shelf";
import { unreadRounds } from "@/server/library/unread-rounds";
import { createBook } from "@/server/library/books";
import { dangTen, vietCung } from "../helpers/library";

/*
 * Khoang Lang tren ke sach (task 4): tat co thi ke co cuon doi phuong + luot doi phuong; bat co thi cuon doi phuong
 * bien mat, sach viet cung chi con phan cua minh (doan trich + so luot + so to moi chi tinh tu luot cua minh).
 * Luot cua doi phuong dang SAU luot cua minh nen moi nhat: khong co loc thi doan trich mac dinh la chu cua doi phuong.
 */

const NOW = new Date("2026-09-21T12:00:00+07:00");

async function ke() {
  const s = await vietCung();
  // Cuon chia se cua rieng doi phuong (seat1), khong viet cung.
  const cuaKia = await createBook(s.db, s.seat1.id, { title: "Sổ của Linh", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
  await dangTen(s.db, s.seat1.id, cuaKia, "Lượt của Linh", "Tờ của Linh");
  // Cuon chia se cua rieng minh (seat2).
  const cuaMinh = await createBook(s.db, s.seat2.id, { title: "Sổ của Mạnh", mode: "chia-se", cover: "chim-bay", youtubeId: null, coverMediaId: null });
  await dangTen(s.db, s.seat2.id, cuaMinh, "Lượt của Mạnh", "Tờ của Mạnh");
  // Sach viet cung: luot cua minh dang TRUOC, luot cua doi phuong dang SAU (moi nhat).
  await dangTen(s.db, s.seat2.id, s.sach, "Lượt mình", "Tờ của Mạnh");
  await dangTen(s.db, s.seat1.id, s.sach, "Lượt kia", "Tờ của Linh");
  return { ...s, cuaKia, cuaMinh };
}

describe("Khoang Lang: ke sach", () => {
  it("tat co (kiem soat duong): ke co cuon doi phuong; sach viet cung lay doan cua luot moi nhat (doi phuong)", async () => {
    const { db, seat2, sach, cuaKia, cuaMinh } = await ke();
    const keSach = await listShelf(db, seat2.id, NOW);
    const ten = keSach.map((b) => b.title);
    expect(ten).toContain("Sổ của Linh");
    expect(ten).toContain("Sổ của Mạnh");
    expect(ten).toContain("Những bữa sáng");
    const chung = keSach.find((b) => b.id === sach)!;
    expect(chung.excerpt).toContain("Tờ của Linh");
    expect(chung.newCount).toBe(1);
    expect(chung.roundCount).toBe(2);
    const luot = await unreadRounds(db, seat2.id, NOW);
    expect(luot.some((l) => !l.mine)).toBe(true);
    expect(luot.some((l) => l.mine)).toBe(true);
    expect(cuaKia).toBeDefined();
    expect(cuaMinh).toBeDefined();
  });

  it("bat co: cuon doi phuong bien mat; sach viet cung con nhung chi phan cua minh", async () => {
    const { db, seat2, sach } = await ke();
    const keSach = await listShelf(db, seat2.id, NOW, true);
    const ten = keSach.map((b) => b.title);
    expect(ten).not.toContain("Sổ của Linh");
    expect(ten).toContain("Sổ của Mạnh");
    expect(ten).toContain("Những bữa sáng");
    const chung = keSach.find((b) => b.id === sach)!;
    expect(chung.excerpt).toContain("Tờ của Mạnh");
    expect(chung.excerpt).not.toContain("Linh");
    expect(chung.newCount).toBe(0);
    expect(chung.roundCount).toBe(1);
    expect(chung.pageCount).toBe(1);
    const luot = await unreadRounds(db, seat2.id, NOW, true);
    expect(luot.some((l) => !l.mine)).toBe(false);
    expect(luot.some((l) => l.mine)).toBe(true);
  });
});

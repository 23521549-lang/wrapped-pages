import { describe, expect, it } from "vitest";
import { docText } from "@/lib/doc/text";
import { readBook } from "@/server/library/pages";
import { submitRoundReply } from "@/server/library/round-replies";
import { dangTen, haiCuon, vietCung } from "../helpers/library";
import { luotCua } from "../helpers/round";

const NOW = new Date("2026-10-05T00:00:00.000Z");
const AN = "Đã ẩn trong Khoảng Lặng";

/*
 * Khoang Lang tren man doc, Q1=(a): to do doi phuong viet bi an han, cho do chi hien dong "Đã ẩn trong Khoảng Lặng";
 * to cua minh con nguyen; so to, vi tri doc, niem phong giu nguyen khi tat co.
 */
describe("Khoang Lang: man doc (Q1a)", () => {
  it("tat co (kiem soat duong): to doi phuong doc duoc, loi hoi dap con", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dangTen(db, seat1.id, chung, "Lượt Linh", "chữ của Linh");
    const roundId = await luotCua(db, chung, 1);
    expect(await submitRoundReply(db, seat2.id, roundId, "Thương ghê.")).toBe("sent");
    const v = (await readBook(db, seat2.id, chung, NOW))!;
    expect(v.sheets.map((s) => docText(s.content))).toEqual(["chữ của Linh"]);
    expect(v.sheets[0].an).toBeFalsy();
    expect(v.replies).toHaveLength(1);
    expect(v.replies[0].body).toBe("Thương ghê.");
  });

  it("bat co, sach cua doi phuong: to an het, chi dong an, loi hoi dap rong", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dangTen(db, seat1.id, chung, "Lượt Linh", "chữ của Linh");
    const roundId = await luotCua(db, chung, 1);
    expect(await submitRoundReply(db, seat2.id, roundId, "Thương ghê.")).toBe("sent");
    const v = (await readBook(db, seat2.id, chung, NOW, true))!;
    expect(v.sheets).toHaveLength(1);
    expect(v.sheets[0].an).toBe(true);
    expect(docText(v.sheets[0].content)).toBe(AN);
    expect(docText(v.sheets[0].content)).not.toContain("chữ của Linh");
    expect(v.replies).toEqual([]);
  });

  it("bat co, sach viet cung: to cua minh con nguyen, to doi phuong an; so to va vi tri giu nguyen", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    await dangTen(db, seat1.id, sach, "Lượt Linh", "chữ của Linh");
    await dangTen(db, seat2.id, sach, "Lượt Mạnh", "chữ của Mạnh");
    const tat = (await readBook(db, seat2.id, sach, NOW))!;
    const bat = (await readBook(db, seat2.id, sach, NOW, true))!;
    expect(tat.sheets.map((s) => docText(s.content))).toEqual(["chữ của Linh", "chữ của Mạnh"]);
    expect(bat.sheets).toHaveLength(2);
    expect(bat.sheets[0].an).toBe(true);
    expect(docText(bat.sheets[0].content)).toBe(AN);
    expect(bat.sheets[1].an).toBeFalsy();
    expect(docText(bat.sheets[1].content)).toBe("chữ của Mạnh");
    expect(bat.rounds.map((r) => r.mine)).toEqual([false, true]);
    // So to, vi tri mo dau, niem phong khong doi.
    expect(bat.sheets.length).toBe(tat.sheets.length);
    expect(bat.firstUnread).toBe(tat.firstUnread);
    expect(bat.seals).toEqual(tat.seals);
  });
});

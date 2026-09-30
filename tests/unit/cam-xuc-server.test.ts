import { describe, it, expect } from "vitest";
import { asc } from "drizzle-orm";
import { activity, camXuc } from "@/server/db/schema";
import { camXucChoToi, daXemCamXuc, thaCamXuc } from "@/server/cam-xuc/cam-xuc";
import { listActivity } from "@/server/feed/list";
import { phienBanKe } from "@/server/feed/version";
import { seedHai } from "../helpers/seed";

/*
 * May chu kho cam xuc (5d, spec B): tha (tam loai, moc 10 giay, ghi dong Hoat dong cung giao dich), hang cho cua nguoi
 * nhan (chi cua nguoi kia, ba cai moi nhat, cu toi moi) va danh da xem (chi cua nguoi kia gui minh, keo theo cai cu hon).
 */

const NOW = new Date("2026-10-01T02:00:00.000Z");
const SAU = (giay: number) => new Date(NOW.getTime() + giay * 1000);

describe("thaCamXuc", () => {
  it("tha mot cam xuc: ghi cam_xuc va dong tha-cam-xuc cung luc, luon chia se", async () => {
    const { db, seat1 } = await seedHai();
    expect(await thaCamXuc(db, seat1.id, "yeu", NOW)).toBe("sent");
    expect(await db.select().from(camXuc)).toMatchObject([{ tuId: seat1.id, loai: "yeu", luc: NOW, daXemLuc: null }]);
    expect(await db.select().from(activity)).toMatchObject([
      { kind: "tha-cam-xuc", actorId: seat1.id, detail: { cam: "yeu" }, shared: true, at: NOW, bookId: null },
    ]);
  });

  it("loai la: invalid, khong ghi gi", async () => {
    const { db, seat1 } = await seedHai();
    for (const la of ["ghet", "Yeu", "", null, 1, { cam: "yeu" }]) expect(await thaCamXuc(db, seat1.id, la, NOW)).toBe("invalid");
    expect(await db.select().from(camXuc)).toEqual([]);
    expect(await db.select().from(activity)).toEqual([]);
  });

  it("hai lan cua cung nguoi cach nhau duoi 10 giay: som; du 10 giay thi duoc; nguoi kia khong bi chan", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await thaCamXuc(db, seat1.id, "yeu", NOW)).toBe("sent");
    expect(await thaCamXuc(db, seat1.id, "nho", SAU(9))).toBe("som");
    expect(await thaCamXuc(db, seat2.id, "vui", SAU(1))).toBe("sent");
    expect(await thaCamXuc(db, seat1.id, "nho", SAU(10))).toBe("sent");
    expect((await db.select().from(camXuc).orderBy(asc(camXuc.luc))).map((r) => r.loai)).toEqual(["yeu", "vui", "nho"]);
    expect(await db.select().from(activity)).toHaveLength(3);
  });

  it("hai lan bam cung luc: chi mot lan lot qua", async () => {
    const { db, seat1 } = await seedHai();
    const kq = await Promise.all([thaCamXuc(db, seat1.id, "yeu", NOW), thaCamXuc(db, seat1.id, "gian", NOW)]);
    expect([...kq].sort()).toEqual(["sent", "som"]);
    expect(await db.select().from(camXuc)).toHaveLength(1);
  });

  it("ca hai nguoi deu thay dong Hoat dong; phien ban ke doi khi nguoi kia tha", async () => {
    const { db, seat1, seat2 } = await seedHai();
    const truoc = await phienBanKe(db, seat2.id, SAU(1));
    await thaCamXuc(db, seat1.id, "treu", NOW);
    expect(await phienBanKe(db, seat2.id, SAU(1))).not.toBe(truoc);
    expect((await listActivity(db, seat2.id, SAU(1))).map((i) => [i.kind, i.by, i.detail])).toEqual([["tha-cam-xuc", "partner", { cam: "treu" }]]);
    expect((await listActivity(db, seat1.id, SAU(1))).map((i) => [i.kind, i.by])).toEqual([["tha-cam-xuc", "me"]]);
  });
});

describe("camXucChoToi", () => {
  it("chi cam xuc nguoi kia gui, chua xem, da toi gio; ba cai moi nhat, cu toi moi", async () => {
    const { db, seat1, seat2 } = await seedHai();
    for (const [i, loai] of (["yeu", "nho", "vui", "buon", "gian"] as const).entries()) await thaCamXuc(db, seat1.id, loai, SAU(i * 20));
    await thaCamXuc(db, seat2.id, "biet-on", SAU(5));
    await thaCamXuc(db, seat1.id, "treu", SAU(999));
    const hang = await camXucChoToi(db, seat2.id, SAU(100));
    expect(hang.map((c) => c.loai)).toEqual(["vui", "buon", "gian"]);
    expect(hang[0]).toEqual({ id: expect.any(String), loai: "vui", luc: SAU(40) });
    expect((await camXucChoToi(db, seat1.id, SAU(100))).map((c) => c.loai)).toEqual(["biet-on"]);
  });

  it("chi doc: goi nhieu lan khong doi gi", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await thaCamXuc(db, seat1.id, "yeu", NOW);
    await camXucChoToi(db, seat2.id, SAU(1));
    expect(await camXucChoToi(db, seat2.id, SAU(2))).toHaveLength(1);
    expect((await db.select().from(camXuc))[0].daXemLuc).toBeNull();
  });
});

describe("daXemCamXuc", () => {
  it("danh cai dang dien va moi cai cu hon chua xem; cai moi hon van cho", async () => {
    const { db, seat1, seat2 } = await seedHai();
    for (const [i, loai] of (["yeu", "nho", "vui", "buon", "gian"] as const).entries()) await thaCamXuc(db, seat1.id, loai, SAU(i * 20));
    const [dau] = await camXucChoToi(db, seat2.id, SAU(100));
    expect(dau.loai).toBe("vui");
    expect(await daXemCamXuc(db, seat2.id, dau.id, SAU(100))).toBe(true);
    const rows = await db.select().from(camXuc).orderBy(asc(camXuc.luc));
    expect(rows.map((r) => [r.loai, r.daXemLuc])).toEqual([
      ["yeu", SAU(100)], ["nho", SAU(100)], ["vui", SAU(100)], ["buon", null], ["gian", null],
    ]);
    expect((await camXucChoToi(db, seat2.id, SAU(100))).map((c) => c.loai)).toEqual(["buon", "gian"]);
  });

  it("goi lai, cam xuc cua chinh minh, id la: false va khong doi gi", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await thaCamXuc(db, seat1.id, "yeu", NOW);
    await thaCamXuc(db, seat2.id, "nho", SAU(1));
    const [cuaManh] = await camXucChoToi(db, seat2.id, SAU(2));
    const [cuaLinh] = await camXucChoToi(db, seat1.id, SAU(2));
    expect(await daXemCamXuc(db, seat1.id, cuaManh.id, SAU(2))).toBe(false);
    expect(await daXemCamXuc(db, seat2.id, "00000000-0000-4000-8000-000000000000", SAU(2))).toBe(false);
    expect(await daXemCamXuc(db, seat2.id, cuaManh.id, SAU(3))).toBe(true);
    expect(await daXemCamXuc(db, seat2.id, cuaManh.id, SAU(4))).toBe(false);
    const rows = await db.select().from(camXuc).orderBy(asc(camXuc.luc));
    expect(rows.map((r) => r.daXemLuc)).toEqual([SAU(3), null]);
    expect(cuaLinh.loai).toBe("nho");
  });
});

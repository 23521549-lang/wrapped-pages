import { describe, expect, it } from "vitest";
import { chaoChip } from "@/server/chip/tro-chuyen";
import { recordActivity } from "@/server/feed/record";
import { demCauLenh } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";
import { seedHai } from "../helpers/seed";

/*
 * NGAN SACH TRUY VAN cua chaoChip. Truoc day ham nay goi listActivity (6 cau lenh) tren MOI lan mo trang, ke ca
 * nhung lan tra ve null (da chao trong ngay roi). Bai nay khoa lai: khi khong co loi chao nao thi chi duoc ton
 * 2 SELECT (trang thai Chip + luc ngu) + 1 upsert moc lan cuoi thay.
 */

const NOW = new Date("2026-10-01T02:00:00.000Z"); // 09:00 gio Viet Nam
const SAU = (giay: number) => new Date(NOW.getTime() + giay * 1000);

describe("ngan sach truy van cua chaoChip", () => {
  it("mo trang lan nua trong ngay: khong chao, khong doc Hoat dong", async () => {
    const s = await seedHai();
    await chaoChip(s.db, s.seat2.id, "Mạnh", "Linh", NOW);
    const so = await demCauLenh(async () => {
      expect(await chaoChip(s.db, s.seat2.id, "Mạnh", "Linh", SAU(60))).toBeNull();
    });
    expect(so).toBeLessThanOrEqual(3);
  });

  it("lan dau trong ngay: van chao kem viec moi nhat cua nguoi kia", async () => {
    const s = await haiCuon();
    const motGioTruoc = new Date(NOW.getTime() - 3_600_000);
    const luot = await luotChu(s.db, s.chung, 1, 1, motGioTruoc);
    await recordActivity(s.db, {
      kind: "dang-trang", actorId: s.seat1.id, at: motGioTruoc, bookId: s.chung, roundId: luot, mode: "chia-se", sealId: null,
    });
    const so = await demCauLenh(async () => {
      const loi = await chaoChip(s.db, s.seat2.id, "Mạnh", "Linh", SAU(60));
      expect(loi?.loai).toBe("chao");
      expect(loi?.cau).toMatch(/^Chào \*\*Mạnh\*\*! Linh .*\*\*Chuyện chưa kể\*\*.* đó\.$/);
      expect(loi?.nut).toEqual({ nhan: "Xem ngay", href: expect.stringMatching(/^\/sach\//) });
    });
    // Loai chao nay can cau "moi" nen van doc Hoat dong: 2 SELECT + 1 upsert + 4 cau cua listActivity (tren PGlite).
    expect(so).toBe(7);
  });
});

import { describe, expect, it } from "vitest";
import { activity, deNghi, readSheets } from "@/server/db/schema";
import { phienBanKe } from "@/server/feed/version";
import { recordActivity } from "@/server/feed/record";
import { setMood } from "@/server/mood/moods";
import { demCauLenh } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

/*
 * NGAN SACH TRUY VAN cua phienBanKe. Truoc day ham nay mo mot anh chup roi chay song song 4 SELECT (cong 3 cau
 * mo/dong anh chup la 7 cau moi 15 giay tren moi tab dang xem). Bai nay khoa lai: ca 4 phan gop trong MOT cau
 * SELECT (cac truy van con vo huong), cong 3 cau cua anh chup.
 */

const NOW = new Date("2026-09-20T08:00:00.000Z");
const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

async function bo() {
  const s = await haiCuon();
  const luot = await luotChu(s.db, s.chung, 1);
  await s.db.delete(activity);
  // Mot dong Hoat dong nguoi xem thay duoc, mot to da doc, mot tam trang dang giu, mot de nghi dang cho.
  await recordActivity(s.db, { kind: "sua-trang", actorId: s.seat1.id, at: phut(-5), bookId: s.chung, roundId: luot, mode: "chia-se" });
  await s.db.insert(readSheets).values({ accountId: s.seat2.id, bookId: s.chung, position: 1 });
  const tam = await setMood(s.db, s.seat2.id, "nang-am", null, phut(-10));
  if (!tam) throw new Error("khong tha duoc tam trang");
  await s.db.insert(deNghi).values({ bookId: s.chung, loai: "xin-viet", tuId: s.seat2.id, luc: NOW });
  return { ...s, luot, tam };
}

describe("ngan sach truy van cua phienBanKe", () => {
  it("4 phan gop trong 1 cau SELECT", async () => {
    const { db, seat2 } = await bo();
    const so = await demCauLenh(() => phienBanKe(db, seat2.id, NOW));
    // 1 SELECT + 1 cau mo giao dich cua anh chup (tren PGlite; tren Postgres that them SET/COMMIT).
    expect(so).toBe(2);
  });

  it("chuoi phien ban giong y nhu truoc khi gop (thu tu giu, de nghi khong doi)", async () => {
    const { db, seat2, chung, tam } = await bo();
    // Dong Hoat dong dem duoc 2: sua-trang o bo() + tha-tam-trang do setMood ghi; moi nhat van la sua-trang.
    expect(await phienBanKe(db, seat2.id, NOW)).toBe(
      `2|${phut(-5).getTime()}|1|${tam.id}|${chung}:xin-viet:${NOW.getTime()}`,
    );
  });
});

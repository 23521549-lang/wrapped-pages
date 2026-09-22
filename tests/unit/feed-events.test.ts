import { describe, it, expect } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import { accounts, activity, drafts, pages, sealAttempts, sealReplies, seals } from "@/server/db/schema";
import { createSeat } from "@/server/identity/accounts";
import { login } from "@/server/identity/login";
import { readSecretHistory, renamePartner, revealSecret } from "@/server/identity/rename";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import { khoangLuot } from "@/server/library/rounds";
import { giftKey, submitReply, tryAnswer } from "@/server/seal/unlock";
import type { SealInput } from "@/lib/seal/types";
import { makeTestDb, type TestDb } from "../helpers/db";
import { haiCuon, to } from "../helpers/library";
import { CAU_DO, dangNiemPhong, henGio, TRAO_DOI } from "../helpers/seal";

const NOW = new Date("2026-09-15T08:00:00.000Z");
const ms = (n: number) => new Date(NOW.getTime() + n);
const KHONG_CO = "00000000-0000-4000-8000-000000000000";

/** Moi su kien da ghi, cu nhat truoc, khong kem id; khoang to tinh tu luot cua su kien. */
function suKien(db: TestDb) {
  return db
    .select({
      kind: activity.kind, actorId: activity.actorId, subjectId: activity.subjectId, bookId: activity.bookId,
      sealId: activity.sealId, firstPosition: khoangLuot.first, lastPosition: khoangLuot.last,
      shared: activity.shared, at: activity.at,
    })
    .from(activity)
    .leftJoin(khoangLuot, eq(khoangLuot.roundId, activity.roundId))
    .orderBy(asc(activity.at), asc(activity.kind));
}

/**
 * Chay hanh dong khi database tu choi moi lenh ghi vao activity, roi go rao. Hanh dong phai nem loi; ca goi
 * kiem tiep rang bang goc khong doi, tuc su kien nam trong dung giao dich cua hanh dong.
 */
async function khiGhiSuKienHong(db: TestDb, hanhDong: () => Promise<unknown>) {
  await db.execute(sql`alter table activity add constraint ep_loi check (false) not valid`);
  try {
    await expect(hanhDong()).rejects.toThrow();
  } finally {
    await db.execute(sql`alter table activity drop constraint ep_loi`);
  }
}

/** Mot cuon chia se co mot niem phong phu to 1; bo su kien cua lan dang de moi ca chi thay su kien cua no. */
async function coNiemPhong(seal: SealInput) {
  const s = await haiCuon();
  await dangNiemPhong(s.db, s.seat1.id, s.chung, seal, "Tờ khóa");
  const [row] = await s.db.select().from(seals).where(eq(seals.bookId, s.chung));
  await s.db.delete(activity);
  return { ...s, sealId: row.id };
}

describe("publishDraft ghi su kien", () => {
  it("dang khong niem phong: dung mot dang-trang, cung now voi cac to", async () => {
    const { db, seat1, chung } = await haiCuon();
    await publishDraft(db, seat1.id, chung, [to("Một"), to("Hai")], null, NOW);
    expect(await suKien(db)).toEqual([{
      kind: "dang-trang", actorId: seat1.id, subjectId: null, bookId: chung, sealId: null,
      firstPosition: 1, lastPosition: 2, shared: true, at: NOW,
    }]);
    expect((await db.select().from(pages)).map((p) => p.publishedAt)).toEqual([NOW, NOW]);
  });

  it("sach rieng tu ghi shared false; lan dang noi tiep ghi dung khoang to cua no", async () => {
    const { db, seat1, rieng } = await haiCuon();
    await publishDraft(db, seat1.id, rieng, [to("Một")], null, NOW);
    await publishDraft(db, seat1.id, rieng, [to("Hai"), to("Ba")], null, ms(1));
    expect((await suKien(db)).map((e) => [e.kind, e.shared, e.firstPosition, e.lastPosition])).toEqual([
      ["dang-trang", false, 1, 1], ["dang-trang", false, 2, 3],
    ]);
  });

  it("cau do: dang-trang mang id niem phong vua tao", async () => {
    const { db, seat1, chung } = await haiCuon();
    await publishDraft(db, seat1.id, chung, [to("Một")], CAU_DO, NOW);
    const [seal] = await db.select().from(seals);
    expect((await suKien(db)).map((e) => [e.kind, e.sealId])).toEqual([["dang-trang", seal.id]]);
  });

  it("trao doi: chi mot moi-trao-doi, khong kem dang-trang", async () => {
    const { db, seat1, chung } = await haiCuon();
    await publishDraft(db, seat1.id, chung, [to("Một"), to("Hai")], TRAO_DOI, NOW);
    const [seal] = await db.select().from(seals);
    expect(await suKien(db)).toEqual([{
      kind: "moi-trao-doi", actorId: seat1.id, subjectId: null, bookId: chung, sealId: seal.id,
      firstPosition: 1, lastPosition: 2, shared: true, at: NOW,
    }]);
  });

  it("hen gio: dang-trang luc dang va mo-hen-gio ghi san voi at = opensAt", async () => {
    const { db, seat1, rieng } = await haiCuon();
    const opensAt = ms(86_400_000);
    await publishDraft(db, seat1.id, rieng, [to("Hộp thời gian")], henGio(opensAt), NOW);
    const [seal] = await db.select().from(seals);
    expect((await suKien(db)).map((e) => [e.kind, e.sealId, e.shared, e.at])).toEqual([
      ["dang-trang", seal.id, false, NOW], ["mo-hen-gio", seal.id, false, opensAt],
    ]);
  });

  it("luu nhap khong ghi gi; lan dang bi tu choi khong ghi gi", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("Nháp"), 1);
    await saveDraft(db, seat1.id, rieng, to("Nháp riêng"), 1);
    expect(await publishDraft(db, seat1.id, rieng, [to("Bí mật")], CAU_DO, NOW)).toBeNull();
    expect(await publishDraft(db, seat2.id, chung, [to("Chen")], null, NOW)).toBeNull();
    expect(await suKien(db)).toEqual([]);
  });

  it("ghi su kien hong thi ca lan dang rollback: khong to, khong niem phong, ban nhap con nguyen", async () => {
    const { db, seat1, chung } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("Một"), 1);
    await khiGhiSuKienHong(db, () => publishDraft(db, seat1.id, chung, [to("Một")], CAU_DO, NOW));
    expect(await db.select().from(pages)).toHaveLength(0);
    expect(await db.select().from(seals)).toHaveLength(0);
    expect(await db.select().from(drafts)).toHaveLength(1);
  });
});

describe("tryAnswer ghi su kien", () => {
  it("sai: dung mot thu-sai, khong chep chuoi da go", async () => {
    const { db, seat2, chung, sealId } = await coNiemPhong(CAU_DO);
    await tryAnswer(db, seat2.id, sealId, "quán cà phê bí mật", NOW);
    expect(await suKien(db)).toEqual([{
      kind: "thu-sai", actorId: seat2.id, subjectId: null, bookId: chung, sealId,
      firstPosition: 1, lastPosition: 1, shared: true, at: NOW,
    }]);
    expect(JSON.stringify(await db.select().from(activity))).not.toContain("quán cà phê");
  });

  it("dung: dung mot mo-trang cung now voi openedAt; hoi lai khi da mo khong ghi them", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    await tryAnswer(db, seat2.id, sealId, "Bến xe Miền Đông", NOW);
    expect(await tryAnswer(db, seat2.id, sealId, "gi cung duoc", ms(1))).toMatchObject({ status: "opened" });
    expect((await suKien(db)).map((e) => [e.kind, e.actorId, e.at])).toEqual([["mo-trang", seat2.id, NOW]]);
    expect((await db.select().from(seals))[0].openedAt).toEqual(NOW);
  });

  it("trong khoang cho, chuoi khong hop le, chu sach hay ma rac: khong ghi su kien nao", async () => {
    const { db, seat1, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await tryAnswer(db, seat2.id, sealId, "   ", NOW)).toEqual({ status: "invalid" });
    expect(await tryAnswer(db, seat1.id, sealId, "ben xe mien dong", NOW)).toBeNull();
    expect(await tryAnswer(db, seat2.id, KHONG_CO, "a", NOW)).toBeNull();
    expect(await suKien(db)).toEqual([]);
    for (let i = 0; i < 5; i++) await tryAnswer(db, seat2.id, sealId, `sai ${i}`, ms(i));
    expect(await tryAnswer(db, seat2.id, sealId, "ben xe mien dong", ms(5))).toMatchObject({ status: "cooldown" });
    expect((await suKien(db)).map((e) => e.kind)).toEqual(Array(5).fill("thu-sai"));
  });

  it("ghi su kien hong thi lan thu va lan mo rollback theo", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    await khiGhiSuKienHong(db, () => tryAnswer(db, seat2.id, sealId, "sai", NOW));
    await khiGhiSuKienHong(db, () => tryAnswer(db, seat2.id, sealId, "ben xe mien dong", NOW));
    expect(await db.select().from(sealAttempts)).toHaveLength(0);
    expect((await db.select().from(seals))[0].openedAt).toBeNull();
  });
});

describe("giftKey ghi su kien", () => {
  it("tang: dung mot tang-khoa cua chu sach; tang lai khi da mo khong ghi them", async () => {
    const { db, seat1, chung, sealId } = await coNiemPhong(CAU_DO);
    await giftKey(db, seat1.id, sealId, "Cho em nè", NOW);
    expect(await giftKey(db, seat1.id, sealId, "Lần hai", ms(1))).toMatchObject({ status: "already" });
    expect(await suKien(db)).toEqual([{
      kind: "tang-khoa", actorId: seat1.id, subjectId: null, bookId: chung, sealId,
      firstPosition: 1, lastPosition: 1, shared: true, at: NOW,
    }]);
  });

  it("nguoi kia hay hen gio khong tang duoc thi khong ghi gi", async () => {
    const a = await coNiemPhong(CAU_DO);
    expect(await giftKey(a.db, a.seat2.id, a.sealId, "", NOW)).toBeNull();
    expect(await suKien(a.db)).toEqual([]);
    const b = await coNiemPhong(henGio(ms(3_600_000)));
    expect(await giftKey(b.db, b.seat1.id, b.sealId, "", NOW)).toBeNull();
    expect(await suKien(b.db)).toEqual([]);
  });

  it("ghi su kien hong thi niem phong van dong va khong luu loi nhan", async () => {
    const { db, seat1, sealId } = await coNiemPhong(TRAO_DOI);
    await khiGhiSuKienHong(db, () => giftKey(db, seat1.id, sealId, "Cho em", NOW));
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: null, giftNote: null });
  });
});

describe("submitReply ghi su kien", () => {
  it("gui: dung mot mo-trang cua nguoi kia; gui lai khi da mo khong ghi them", async () => {
    const { db, seat2, chung, sealId } = await coNiemPhong(TRAO_DOI);
    await submitReply(db, seat2.id, sealId, to("Em nghĩ về anh"), NOW);
    expect(await submitReply(db, seat2.id, sealId, to("Lần hai"), ms(1))).toMatchObject({ status: "already" });
    expect(await suKien(db)).toEqual([{
      kind: "mo-trang", actorId: seat2.id, subjectId: null, bookId: chung, sealId,
      firstPosition: 1, lastPosition: 1, shared: true, at: NOW,
    }]);
  });

  it("da tang chia khoa thi gui trang tra loi khong ghi them; chu sach tu tra loi khong ghi gi", async () => {
    const { db, seat1, seat2, sealId } = await coNiemPhong(TRAO_DOI);
    expect(await submitReply(db, seat1.id, sealId, to("Tự trả lời"), NOW)).toBeNull();
    await giftKey(db, seat1.id, sealId, "", NOW);
    expect(await submitReply(db, seat2.id, sealId, to("Muộn"), ms(1))).toMatchObject({ status: "already" });
    expect((await suKien(db)).map((e) => e.kind)).toEqual(["tang-khoa"]);
  });

  it("ghi su kien hong thi khong luu trang tra loi va niem phong van dong", async () => {
    const { db, seat2, sealId } = await coNiemPhong(TRAO_DOI);
    await khiGhiSuKienHong(db, () => submitReply(db, seat2.id, sealId, to("Em nghĩ về anh"), NOW));
    expect(await db.select().from(sealReplies)).toHaveLength(0);
    expect((await db.select().from(seals))[0].openedAt).toBeNull();
  });
});

describe("renamePartner ghi su kien", () => {
  const KEY = "khoa-test";

  async function haiNguoi() {
    const db = await makeTestDb();
    const a = await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-manh", serverKey: KEY });
    await createSeat(db, { nickname: "Manh", secret: "hien nha", deviceId: "may-linh", serverKey: KEY });
    const rows = await db.select().from(accounts);
    return { db, a, seat1: rows.find((r) => r.seat === 1)!, seat2: rows.find((r) => r.seat === 2)! };
  }

  it("tao cho ngoi va gui loi nhan khong ghi gi; doi ten ghi dung mot doi-mat-khau cung now voi updatedAt", async () => {
    const { db, seat1, seat2 } = await haiNguoi();
    const [goc] = await readSecretHistory(db, { actorAccountId: seat2.id, serverKey: KEY });
    await revealSecret(db, { actorAccountId: seat2.id, historyId: goc.id });
    expect(await suKien(db)).toEqual([]);
    // Moc co dinh: mot new Date() thu hai trong renamePartner (cho updatedAt hay cho su kien) se lech NOW.
    await renamePartner(db, { actorAccountId: seat2.id, nickname: "Linh Nhi", secret: "ben xe", serverKey: KEY }, NOW);
    const [doi] = await db.select().from(accounts).where(eq(accounts.id, seat1.id));
    expect(doi.updatedAt).toEqual(NOW);
    expect(await suKien(db)).toEqual([{
      kind: "doi-mat-khau", actorId: seat2.id, subjectId: seat1.id, bookId: null, sealId: null,
      firstPosition: null, lastPosition: null, shared: false, at: NOW,
    }]);
  });

  it("ghi su kien hong thi mat khau cua nguoi kia khong doi va lich su khong them", async () => {
    const { db, a, seat2 } = await haiNguoi();
    await khiGhiSuKienHong(db, () => renamePartner(db, {
      actorAccountId: seat2.id, nickname: "Linh Nhi", secret: "ben xe", serverKey: KEY,
    }));
    expect(await readSecretHistory(db, { actorAccountId: seat2.id, serverKey: KEY })).toHaveLength(1);
    const r = await login(db, { password: a.password, deviceId: "may-thu-ba" });
    expect(r.ok && r.seat).toBe(1);
  });
});

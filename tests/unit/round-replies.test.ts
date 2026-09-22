import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { activity, books, roundReplies } from "@/server/db/schema";
import { readBook } from "@/server/library/pages";
import { repliesOfBook, submitRoundReply } from "@/server/library/round-replies";
import { sealsOfBook } from "@/server/seal/seals";
import { tryAnswer } from "@/server/seal/unlock";
import { REPLY_MAX } from "@/lib/round-reply";
import { dang, haiCuon } from "../helpers/library";
import { luotCua } from "../helpers/round";
import { CAU_DO, dangNiemPhong, henGio } from "../helpers/seal";

const NOW = new Date("2026-09-22T01:00:00.000Z");
const LF = String.fromCharCode(10);
const KHONG_CO = "00000000-0000-4000-8000-000000000000";

/** Cuon chia se cua seat1 co mot luot hai to; tra id luot. */
async function coLuot() {
  const s = await haiCuon();
  await dang(s.db, s.seat1.id, s.chung, "Một", "Hai");
  return { ...s, roundId: await luotCua(s.db, s.chung, 1) };
}

describe("submitRoundReply", () => {
  it("nguoi kia gui cho luot khong niem phong: luu dung chu da chuan hoa, cua nguoi gui, luc now", async () => {
    const { db, seat2, roundId } = await coLuot();
    expect(await submitRoundReply(db, seat2.id, roundId, `  Thương ghê.${LF}${LF}${LF}${LF}Cảm ơn nhé.  `, NOW)).toBe("sent");
    expect(await db.select().from(roundReplies)).toEqual([
      { roundId, accountId: seat2.id, body: `Thương ghê.${LF}${LF}${LF}Cảm ơn nhé.`, createdAt: NOW },
    ]);
  });

  it("gui lan hai thi exists: giu loi dau, khong ghi them su kien", async () => {
    const { db, seat2, roundId } = await coLuot();
    await db.delete(activity);
    await submitRoundReply(db, seat2.id, roundId, "Lần một", NOW);
    expect(await submitRoundReply(db, seat2.id, roundId, "Lần hai", NOW)).toBe("exists");
    expect((await db.select().from(roundReplies)).map((r) => r.body)).toEqual(["Lần một"]);
    expect(await db.select().from(activity)).toHaveLength(1);
  });

  it("hai lan gui dong thoi: dung mot lan sent, mot dong, mot su kien", async () => {
    const { db, seat2, roundId } = await coLuot();
    await db.delete(activity);
    const ket = await Promise.all([
      submitRoundReply(db, seat2.id, roundId, "Tab một", NOW),
      submitRoundReply(db, seat2.id, roundId, "Tab hai", NOW),
    ]);
    expect([...ket].sort()).toEqual(["exists", "sent"]);
    expect(await db.select().from(roundReplies)).toHaveLength(1);
    expect(await db.select().from(activity)).toHaveLength(1);
  });

  it("chu sach, sach rieng tu, luot la hay ma rac: not-found, khong ghi gi", async () => {
    const { db, seat1, seat2, rieng, roundId } = await coLuot();
    await dang(db, seat1.id, rieng, "Riêng");
    await db.delete(activity);
    expect(await submitRoundReply(db, seat1.id, roundId, "Tự hồi đáp", NOW)).toBe("not-found");
    expect(await submitRoundReply(db, seat2.id, await luotCua(db, rieng, 1), "Lén", NOW)).toBe("not-found");
    expect(await submitRoundReply(db, seat2.id, KHONG_CO, "Lạ", NOW)).toBe("not-found");
    expect(await submitRoundReply(db, seat2.id, "rac", "Rác", NOW)).toBe("not-found");
    expect(await db.select().from(roundReplies)).toEqual([]);
    expect(await db.select().from(activity)).toEqual([]);
  });

  it("sach chia se roi chuyen rieng tu: nguoi kia khong gui duoc nua", async () => {
    const { db, seat2, chung, roundId } = await coLuot();
    await db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, chung));
    expect(await submitRoundReply(db, seat2.id, roundId, "Muộn", NOW)).toBe("not-found");
  });

  it("chu sai: invalid truoc khi cham database, ke ca voi luot la va chu sach", async () => {
    const { db, seat1, seat2, roundId } = await coLuot();
    for (const body of ["", `  ${LF}  `, "a".repeat(REPLY_MAX + 1), 42, null, `a${String.fromCharCode(0)}b`]) {
      expect(await submitRoundReply(db, seat2.id, roundId, body, NOW)).toBe("invalid");
    }
    expect(await submitRoundReply(db, seat1.id, KHONG_CO, "", NOW)).toBe("invalid");
    expect(await db.select().from(roundReplies)).toEqual([]);
  });

  it("cau do chua giai thi sealed; giai xong thi gui duoc", async () => {
    const s = await haiCuon();
    await dangNiemPhong(s.db, s.seat1.id, s.chung, CAU_DO, "Tờ khóa");
    const roundId = await luotCua(s.db, s.chung, 1);
    const [seal] = await sealsOfBook(s.db, s.chung);
    expect(await submitRoundReply(s.db, s.seat2.id, roundId, "Sớm quá", NOW)).toBe("sealed");
    expect(await s.db.select().from(roundReplies)).toEqual([]);
    expect(await tryAnswer(s.db, s.seat2.id, seal.id, "ben xe mien dong", NOW)).toMatchObject({ status: "opened" });
    expect(await submitRoundReply(s.db, s.seat2.id, roundId, "Mở rồi", NOW)).toBe("sent");
  });

  it("hen gio chua toi gio thi sealed; qua gio thi gui duoc", async () => {
    const s = await haiCuon();
    const mo = new Date(Date.now() + 3_600_000);
    await dangNiemPhong(s.db, s.seat1.id, s.chung, henGio(mo), "Thư hẹn");
    const roundId = await luotCua(s.db, s.chung, 1);
    expect(await submitRoundReply(s.db, s.seat2.id, roundId, "Sớm", new Date(mo.getTime() - 1))).toBe("sealed");
    expect(await submitRoundReply(s.db, s.seat2.id, roundId, "Đúng giờ", mo)).toBe("sent");
  });
});

describe("loi hoi dap tren man doc", () => {
  it("repliesOfBook va readBook: ca hai nguoi thay loi hoi dap cua sach chia se", async () => {
    const { db, seat1, seat2, chung, roundId } = await coLuot();
    await submitRoundReply(db, seat2.id, roundId, "Thương ghê.", NOW);
    const mot = [{ roundId, body: "Thương ghê.", createdAt: NOW }];
    expect(await repliesOfBook(db, chung)).toEqual(mot);
    expect((await readBook(db, seat1.id, chung))?.replies).toEqual(mot);
    expect((await readBook(db, seat2.id, chung))?.replies).toEqual(mot);
  });

  it("sach chuyen rieng tu: readBook khong doc loi hoi dap, nhung du lieu van con", async () => {
    const { db, seat1, seat2, chung, roundId } = await coLuot();
    await submitRoundReply(db, seat2.id, roundId, "Thương ghê.", NOW);
    await db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, chung));
    expect((await readBook(db, seat1.id, chung))?.replies).toEqual([]);
    expect(await repliesOfBook(db, chung)).toHaveLength(1);
  });
});

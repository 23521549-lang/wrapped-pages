import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { sealAttempts, sealReplies, seals } from "@/server/db/schema";
import { giftKey, submitReply, tryAnswer } from "@/server/seal/unlock";
import { readBook } from "@/server/library/pages";
import { SEAL_COOLDOWN_MS } from "@/lib/seal/attempts";
import { SEAL_LIMITS, type SealInput } from "@/lib/seal/types";
import type { DocJson } from "@/lib/doc/types";
import { haiCuon, to } from "../helpers/library";
import { luotChu } from "../helpers/round";
import { CAU_DO, dangNiemPhong, henGio, TRAO_DOI } from "../helpers/seal";

const NOW = new Date("2026-09-13T08:00:00.000Z");
const ms = (n: number) => new Date(NOW.getTime() + n);
const KHONG_CO = "00000000-0000-4000-8000-000000000000";

async function coNiemPhong(seal: SealInput) {
  const s = await haiCuon();
  await dangNiemPhong(s.db, s.seat1.id, s.chung, seal, "Tờ khóa");
  const [row] = await s.db.select().from(seals).where(eq(seals.bookId, s.chung));
  return { ...s, sealId: row.id };
}

describe("tryAnswer", () => {
  it("sai thi ghi lai lan thu va con 4 lan", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await tryAnswer(db, seat2.id, sealId, "quán cà phê", NOW))
      .toEqual({ status: "wrong", state: { hintsUnlocked: 0, remaining: 4, lockedUntil: null } });
    expect(await db.select().from(sealAttempts)).toMatchObject([{ guess: "quán cà phê", correct: false, accountId: seat2.id }]);
  });

  it("sai lan thu 5 thi bat dau cho; trong luc cho khong ghi them lan thu nao, ke ca dap an dung", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    for (let i = 0; i < 4; i++) await tryAnswer(db, seat2.id, sealId, `sai ${i}`, ms(i));
    expect(await tryAnswer(db, seat2.id, sealId, "sai 4", ms(4)))
      .toMatchObject({ status: "wrong", state: { remaining: 0, lockedUntil: ms(4 + SEAL_COOLDOWN_MS) } });
    expect(await tryAnswer(db, seat2.id, sealId, "Bến xe Miền Đông", ms(5))).toMatchObject({ status: "cooldown" });
    expect(await db.select().from(sealAttempts)).toHaveLength(5);
    expect((await db.select().from(seals))[0].openedAt).toBeNull();
  });

  it("het cho thi tra loi dung mo trang cho nguoi kia", async () => {
    const { db, seat2, chung, sealId } = await coNiemPhong(CAU_DO);
    for (let i = 0; i < 5; i++) await tryAnswer(db, seat2.id, sealId, `sai ${i}`, ms(i));
    const luc = ms(4 + SEAL_COOLDOWN_MS);
    expect(await tryAnswer(db, seat2.id, sealId, "Bến xe Miền Đông!", luc)).toEqual({ status: "opened", bookId: chung, firstPosition: 1 });
    expect((await db.select().from(seals))[0].openedAt).toEqual(luc);
    expect((await db.select().from(sealAttempts)).filter((a) => a.correct)).toHaveLength(1);
  });

  it("chuoi rong, qua dai hoac co ky tu Postgres khong luu duoc la khong hop le va khong ghi lan thu nao", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await tryAnswer(db, seat2.id, sealId, "   ", NOW)).toEqual({ status: "invalid" });
    expect(await tryAnswer(db, seat2.id, sealId, "a".repeat(SEAL_LIMITS.guessMax + 1), NOW)).toEqual({ status: "invalid" });
    expect(await tryAnswer(db, seat2.id, sealId, `a${String.fromCharCode(0)}`, NOW)).toEqual({ status: "invalid" });
    expect(await db.select().from(sealAttempts)).toHaveLength(0);
  });

  it("da mo roi thi tra ve da mo, khong ghi them lan thu", async () => {
    const { db, seat2, chung, sealId } = await coNiemPhong(CAU_DO);
    await tryAnswer(db, seat2.id, sealId, "ben xe mien dong", NOW);
    expect(await tryAnswer(db, seat2.id, sealId, "gi cung duoc", ms(1))).toEqual({ status: "opened", bookId: chung, firstPosition: 1 });
    expect(await db.select().from(sealAttempts)).toHaveLength(1);
    expect((await db.select().from(seals))[0].openedAt).toEqual(NOW);
  });

  it("dap an dung 200 ky tu duoc chap nhan", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await tryAnswer(db, seat2.id, sealId, "a".repeat(SEAL_LIMITS.guessMax), NOW)).toMatchObject({ status: "wrong" });
    expect(await db.select().from(sealAttempts)).toHaveLength(1);
  });

  it("dap an chi con dau cau sau khi chuan hoa la rong thi khong hop le va khong ghi lan thu", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await tryAnswer(db, seat2.id, sealId, "?!", NOW)).toEqual({ status: "invalid" });
    expect(await db.select().from(sealAttempts)).toHaveLength(0);
  });

  it("chu sach, ma rac va ma khong ton tai deu nhu khong ton tai", async () => {
    const { db, seat1, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await tryAnswer(db, seat1.id, sealId, "ben xe mien dong", NOW)).toBeNull();
    expect(await tryAnswer(db, seat2.id, "khong-phai-uuid", "a", NOW)).toBeNull();
    expect(await tryAnswer(db, seat2.id, KHONG_CO, "a", NOW)).toBeNull();
    expect(await db.select().from(sealAttempts)).toHaveLength(0);
  });

  it("hen gio va trao doi khong nhan dap an", async () => {
    const a = await coNiemPhong(henGio(ms(3_600_000)));
    expect(await tryAnswer(a.db, a.seat2.id, a.sealId, "a", NOW)).toBeNull();
    const b = await coNiemPhong(TRAO_DOI);
    expect(await tryAnswer(b.db, b.seat2.id, b.sealId, "a", NOW)).toBeNull();
  });

  it("cau do nam tren sach rieng tu thi nguoi kia khong cham toi duoc", async () => {
    const { db, seat2, rieng } = await haiCuon();
    const roundId = await luotChu(db, rieng, 1);
    const [s] = await db
      .insert(seals)
      .values({ bookId: rieng, roundId, kind: "cau-do", question: "?", answers: ["a"], teaser: "" })
      .returning({ id: seals.id });
    expect(await tryAnswer(db, seat2.id, s.id, "a", NOW)).toBeNull();
  });

  it("da duoc tang chia khoa thi dap an dung tra ve da mo ma khong ghi lan thu", async () => {
    const { db, seat1, seat2, chung, sealId } = await coNiemPhong(CAU_DO);
    await giftKey(db, seat1.id, sealId, "", NOW);
    expect(await tryAnswer(db, seat2.id, sealId, "ben xe mien dong", ms(1))).toEqual({ status: "opened", bookId: chung, firstPosition: 1 });
    expect(await db.select().from(sealAttempts)).toHaveLength(0);
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: NOW, giftNote: null });
    expect((await readBook(db, seat2.id, chung, ms(2)))!.seals[0]).toMatchObject({ ritual: false });
  });
});

describe("giftKey", () => {
  it("chu sach tang chia khoa cau do kem loi nhan thi mo cho nguoi kia", async () => {
    const { db, seat1, chung, sealId } = await coNiemPhong(CAU_DO);
    expect(await giftKey(db, seat1.id, sealId, "  Cho em nè  ", NOW)).toEqual({ status: "opened", bookId: chung, firstPosition: 1 });
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: NOW, giftNote: "Cho em nè" });
  });

  it("loi nhan rong thi luu null", async () => {
    const { db, seat1, sealId } = await coNiemPhong(TRAO_DOI);
    await giftKey(db, seat1.id, sealId, "   ", NOW);
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: NOW, giftNote: null });
  });

  it("nguoi kia khong tang duoc, da mo roi khong tang lai, loi nhan qua dai hoac khong luu duoc bi tu choi", async () => {
    const { db, seat1, seat2, chung, sealId } = await coNiemPhong(CAU_DO);
    expect(await giftKey(db, seat2.id, sealId, "", NOW)).toBeNull();
    expect(await giftKey(db, seat1.id, sealId, "a".repeat(SEAL_LIMITS.giftNoteMax + 1), NOW)).toBeNull();
    expect(await giftKey(db, seat1.id, sealId, `Cho em${String.fromCharCode(0xd800)}`, NOW)).toBeNull();
    expect((await db.select().from(seals))[0].openedAt).toBeNull();
    await giftKey(db, seat1.id, sealId, "", NOW);
    expect(await giftKey(db, seat1.id, sealId, "lan hai", ms(1))).toEqual({ status: "already", bookId: chung, firstPosition: 1 });
    expect(await giftKey(db, seat2.id, sealId, "lan hai", ms(1))).toBeNull();
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: NOW, giftNote: null });
  });

  it("tang lan hai sau khi da mo (tab khac da tang) thi tra ve da mo de chuyen toi trang, khong ghi gi", async () => {
    const { db, seat1, chung, sealId } = await coNiemPhong(TRAO_DOI);
    await giftKey(db, seat1.id, sealId, "Cho em", NOW);
    expect(await giftKey(db, seat1.id, sealId, "Lan hai", ms(1))).toEqual({ status: "already", bookId: chung, firstPosition: 1 });
    expect(await db.select().from(seals)).toMatchObject([{ openedAt: NOW, giftNote: "Cho em" }]);
    expect(await db.select().from(sealReplies)).toHaveLength(0);
  });

  it("hen gio khong tang chia khoa duoc", async () => {
    const { db, seat1, sealId } = await coNiemPhong(henGio(ms(3_600_000)));
    expect(await giftKey(db, seat1.id, sealId, "", NOW)).toBeNull();
    expect((await db.select().from(seals))[0].openedAt).toBeNull();
  });

  it("da co trang tra loi thi khong tang chia khoa nua, chi tra ve da mo", async () => {
    const { db, seat1, seat2, chung, sealId } = await coNiemPhong(TRAO_DOI);
    await submitReply(db, seat2.id, sealId, to("Em nghĩ về anh"), NOW);
    expect(await giftKey(db, seat1.id, sealId, "muộn", ms(1))).toEqual({ status: "already", bookId: chung, firstPosition: 1 });
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: NOW, giftNote: null });
  });
});

describe("submitReply", () => {
  it("nguoi kia gui trang tra loi thi luu trang va mo cho ca hai", async () => {
    const { db, seat2, chung, sealId } = await coNiemPhong(TRAO_DOI);
    expect(await submitReply(db, seat2.id, sealId, to("Em nghĩ về anh"), NOW)).toEqual({ status: "opened", bookId: chung, firstPosition: 1 });
    expect(await db.select().from(sealReplies)).toMatchObject([{ sealId, accountId: seat2.id }]);
    expect((await db.select().from(seals))[0].openedAt).toEqual(NOW);
  });

  it("chu sach khong tu tra loi; gui lan hai thi tra ve da mo ma khong ghi trang thu hai", async () => {
    const { db, seat1, seat2, chung, sealId } = await coNiemPhong(TRAO_DOI);
    expect(await submitReply(db, seat1.id, sealId, to("Tự trả lời"), NOW)).toBeNull();
    await submitReply(db, seat2.id, sealId, to("Lần một"), NOW);
    expect(await submitReply(db, seat2.id, sealId, to("Lần hai"), ms(1))).toEqual({ status: "already", bookId: chung, firstPosition: 1 });
    expect(await submitReply(db, seat1.id, sealId, to("Tự trả lời"), ms(1))).toBeNull();
    const replies = await db.select().from(sealReplies);
    expect(replies).toHaveLength(1);
    expect(replies[0].content).toEqual(to("Lần một"));
    expect((await db.select().from(seals))[0].openedAt).toEqual(NOW);
  });

  it("cau do khong nhan trang tra loi", async () => {
    const { db, seat2, sealId } = await coNiemPhong(CAU_DO);
    expect(await submitReply(db, seat2.id, sealId, to("Không phải chỗ này"), NOW)).toBeNull();
  });

  it("trang tra loi trong hoac qua tran ky tu bi tu choi", async () => {
    const { db, seat2, sealId } = await coNiemPhong(TRAO_DOI);
    const trong: DocJson = { type: "doc", content: [{ type: "paragraph" }] };
    expect(await submitReply(db, seat2.id, sealId, trong, NOW)).toBeNull();
    expect(await submitReply(db, seat2.id, sealId, to("a".repeat(SEAL_LIMITS.replyMaxChars + 1)), NOW)).toBeNull();
    expect(await db.select().from(sealReplies)).toHaveLength(0);
    expect((await db.select().from(seals))[0].openedAt).toBeNull();
  });

  it("trang tra loi dung SEAL_LIMITS.replyMaxChars ky tu duoc chap nhan", async () => {
    const { db, seat2, sealId } = await coNiemPhong(TRAO_DOI);
    expect(await submitReply(db, seat2.id, sealId, to("a".repeat(SEAL_LIMITS.replyMaxChars)), NOW)).toMatchObject({ status: "opened" });
  });

  it("trao doi nam tren sach rieng tu thi nguoi kia khong gui duoc", async () => {
    const { db, seat2, rieng } = await haiCuon();
    const roundId = await luotChu(db, rieng, 1);
    const [s] = await db
      .insert(seals)
      .values({ bookId: rieng, roundId, kind: "trao-doi", question: "?", teaser: "" })
      .returning({ id: seals.id });
    expect(await submitReply(db, seat2.id, s.id, to("x"), NOW)).toBeNull();
    expect(await db.select().from(sealReplies)).toHaveLength(0);
  });

  it("da tang chia khoa thi tra ve da mo, khong nhan trang tra loi va khong doi gi", async () => {
    const { db, seat1, seat2, chung, sealId } = await coNiemPhong(TRAO_DOI);
    await giftKey(db, seat1.id, sealId, "Cho em", NOW);
    expect(await submitReply(db, seat2.id, sealId, to("Trả lời muộn"), ms(1))).toEqual({ status: "already", bookId: chung, firstPosition: 1 });
    expect(await db.select().from(sealReplies)).toHaveLength(0);
    expect((await db.select().from(seals))[0]).toMatchObject({ openedAt: NOW, giftNote: "Cho em" });
    expect((await readBook(db, seat2.id, chung, ms(2)))!.seals[0]).toMatchObject({ ritual: false });
  });
});

/** Moi cau SQL drizzle gui di, ke ca trong giao dich: session con cua giao dich dung lai options.logger. */
function ghiSql(db: unknown): string[] {
  const qs: string[] = [];
  const logger = { logQuery: (q: string) => qs.push(q.toLowerCase()) };
  const session = (db as { session: { logger: unknown; options: Record<string, unknown> } }).session;
  session.logger = logger;
  session.options = { ...session.options, logger };
  return qs;
}

describe("khoa dong niem phong truoc khi doc hay ghi (hai tab, bam hai lan)", () => {
  // PGlite mot ket noi khong tai hien duoc hai giao dich chen nhau; Postgres bao dam phan con lai khi co FOR UPDATE.
  it("tryAnswer khoa dong niem phong truoc khi doc lan sai va ghi lan thu", async () => {
    const s = await coNiemPhong(CAU_DO);
    const qs = ghiSql(s.db);
    await tryAnswer(s.db, s.seat2.id, s.sealId, "sai", NOW);
    const khoa = qs.findIndex((q) => q.includes('from "seals"') && q.endsWith("for update"));
    expect(khoa).toBeGreaterThanOrEqual(0);
    expect(khoa).toBeLessThan(qs.findIndex((q) => q.includes('from "seal_attempts"')));
    expect(khoa).toBeLessThan(qs.findIndex((q) => q.startsWith('insert into "seal_attempts"')));
  });

  it("giftKey va submitReply khoa dong niem phong truoc khi ghi", async () => {
    const a = await coNiemPhong(CAU_DO);
    const qa = ghiSql(a.db);
    await giftKey(a.db, a.seat1.id, a.sealId, "", NOW);
    expect(qa[0]?.endsWith("for update")).toBe(true);
    const b = await coNiemPhong(TRAO_DOI);
    const qb = ghiSql(b.db);
    await submitReply(b.db, b.seat2.id, b.sealId, to("Tra loi"), NOW);
    const khoa = qb.findIndex((q) => q.endsWith("for update"));
    expect(khoa).toBeGreaterThanOrEqual(0);
    expect(khoa).toBeLessThan(qb.findIndex((q) => q.startsWith('insert into "seal_replies"')));
  });
});

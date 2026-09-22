import { describe, it, expect } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { readMarks, sealAttempts, sealReplies, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import { markRead, readBook } from "@/server/library/pages";
import { listShelf } from "@/server/library/shelf";
import { sealsOfBook } from "@/server/seal/seals";
import type { DocJson } from "@/lib/doc/types";
import { SEAL_COOLDOWN_MS } from "@/lib/seal/attempts";
import { RITUAL_WINDOW_MS, type SealInput } from "@/lib/seal/types";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";
import { CAU_DO, GOI_Y, henGio, TRAO_DOI } from "../helpers/seal";

const NOW = new Date("2026-09-13T08:00:00.000Z");
const ms = (n: number) => new Date(NOW.getTime() + n);
const phut = (n: number) => ms(n * 60_000);
const BI_MAT = "CHU BI MAT KHONG DUOC LO";
/** Chu bi mat rieng cua tung to, de soi to nao lo va to nao khong. */
const biMat = (i: number) => `BIMAT-${i}-XYZ`;

/** To co dong dau la dau, doan sau chua chu bi mat de soi ro ri. */
const toKhoa = (dau: string, bi: string = BI_MAT): DocJson => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: dau }] },
    { type: "paragraph", content: [{ type: "text", text: bi }] },
  ],
});

type Bo = Awaited<ReturnType<typeof haiCuon>>;

/** Dang cac to vao cuon chung kem mot niem phong (hoac khong), tra ve id niem phong phu to dau cua lo. */
async function dangTo(s: Bo, seal: SealInput | null, ...docs: DocJson[]) {
  await saveDraft(s.db, s.seat1.id, s.chung, docs[0], docs.length);
  const r = await publishDraft(s.db, s.seat1.id, s.chung, docs, seal);
  if (!r) throw new Error("khong dang duoc");
  const rows = await sealsOfBook(s.db, s.chung);
  return rows.find((x) => x.firstPosition === r.firstPosition)?.id ?? null;
}

/** Moc da doc cua seat2 tren cuon chung, undefined neu chua co. */
const mocCua = async (s: Bo) =>
  (await s.db.select().from(readMarks).where(and(eq(readMarks.accountId, s.seat2.id), eq(readMarks.bookId, s.chung))))[0]?.position;

/** Cuon chia se: to 1 mo, to 2 va 3 bi niem phong. */
async function sachCoKhoa(seal: SealInput) {
  const s = await haiCuon();
  await dang(s.db, s.seat1.id, s.chung, "Tờ mở");
  await saveDraft(s.db, s.seat1.id, s.chung, toKhoa("Dòng hé lộ"), 2);
  const r = await publishDraft(s.db, s.seat1.id, s.chung, [toKhoa("Dòng hé lộ"), toKhoa("Tờ thứ ba")], seal);
  if (!r) throw new Error("khong dang duoc");
  const [row] = await s.db.select().from(seals).where(eq(seals.bookId, s.chung));
  return { ...s, sealId: row.id };
}

describe("readBook che to khoa", () => {
  it("nguoi kia chi nhan dong he lo cua to dau, khong nhan chu that, dap an hay goi y chua mo", async () => {
    const { db, seat2, chung } = await sachCoKhoa(CAU_DO);
    const view = await readBook(db, seat2.id, chung, NOW);
    expect(view!.sheets.map((s) => [s.position, s.locked, s.teaser])).toEqual([
      [1, false, null], [2, true, "Dòng hé lộ"], [3, true, null],
    ]);
    const json = JSON.stringify(view);
    for (const lo of [BI_MAT, "Tờ thứ ba", "ben xe mien dong", ...GOI_Y]) expect(json).not.toContain(lo);
    expect(view!.seals[0]).toMatchObject({
      kind: "cau-do", locked: true, mine: false, question: "Mình gặp nhau ở đâu?",
      hints: [], remaining: 5, lockedUntil: null, answerCount: null, knocks: [], reply: null,
    });
  });

  it("sai hai lan thi nguoi kia nhan dung goi y 1, van khong nhan goi y 2", async () => {
    const { db, seat2, chung, sealId } = await sachCoKhoa(CAU_DO);
    await db.insert(sealAttempts).values([
      { sealId, accountId: seat2.id, guess: "sai một", correct: false, at: phut(-3) },
      { sealId, accountId: seat2.id, guess: "sai hai", correct: false, at: phut(-2) },
    ]);
    const view = await readBook(db, seat2.id, chung, NOW);
    expect(view!.seals[0]).toMatchObject({ hints: [GOI_Y[0]], remaining: 3 });
    expect(JSON.stringify(view)).not.toContain(GOI_Y[1]);
  });

  it("sai 4 lan mo goi y 2; sai lan 5 phai cho dung 10 phut; het cho thu lai duoc; mo roi thi het goi y va co loi nhan tang", async () => {
    const s = await haiCuon();
    const id = (await dangTo(s, CAU_DO, toKhoa("He", biMat(1))))!;
    const sai = (k: number) => ({ sealId: id, accountId: s.seat2.id, guess: `sai-${k}`, correct: false, at: phut(-30 + k) });
    await s.db.insert(sealAttempts).values([sai(0), sai(1), sai(2), sai(3)]);
    let r = (await readBook(s.db, s.seat2.id, s.chung, NOW))!.seals[0];
    expect(r).toMatchObject({ hints: [GOI_Y[0], GOI_Y[1]], remaining: 1, lockedUntil: null, knocks: [] });
    expect(JSON.stringify(r)).not.toContain(GOI_Y[2]);
    expect(JSON.stringify(r)).not.toContain("sai-0");
    await s.db.insert(sealAttempts).values({ sealId: id, accountId: s.seat2.id, guess: "sai-4", correct: false, at: phut(-1) });
    r = (await readBook(s.db, s.seat2.id, s.chung, NOW))!.seals[0];
    expect(r).toMatchObject({ hints: [GOI_Y[0], GOI_Y[1]], remaining: 0, lockedUntil: ms(-60_000 + SEAL_COOLDOWN_MS) });
    r = (await readBook(s.db, s.seat2.id, s.chung, ms(-60_000 + SEAL_COOLDOWN_MS)))!.seals[0];
    expect(r).toMatchObject({ remaining: 5, lockedUntil: null });
    const chu = (await readBook(s.db, s.seat1.id, s.chung, NOW))!.seals[0];
    expect(chu).toMatchObject({ hints: [...GOI_Y], remaining: null, lockedUntil: null, answerCount: 1, ritual: false });
    expect(chu.knocks).toHaveLength(5);
    expect(JSON.stringify(chu)).not.toContain("ben xe mien dong");
    await s.db.update(seals).set({ openedAt: NOW, giftNote: "tang" }).where(eq(seals.id, id));
    r = (await readBook(s.db, s.seat2.id, s.chung, NOW))!.seals[0];
    expect(r).toMatchObject({ hints: [], remaining: null, lockedUntil: null, ritual: false, giftNote: "tang", knocks: [] });
  });

  it("chu sach doc to cua minh binh thuong, thay nhat ky go cua, khong bao gio nhan dap an", async () => {
    const { db, seat1, seat2, chung, sealId } = await sachCoKhoa(CAU_DO);
    await db.insert(sealAttempts).values({ sealId, accountId: seat2.id, guess: "quán cà phê", correct: false, at: phut(-1) });
    const view = await readBook(db, seat1.id, chung, NOW);
    expect(view!.sheets.every((s) => !s.locked)).toBe(true);
    const json = JSON.stringify(view);
    expect(json).toContain(BI_MAT);
    expect(json).not.toContain("ben xe mien dong");
    expect(view!.seals[0]).toMatchObject({
      mine: true, locked: false, answerCount: 1, hints: [...GOI_Y],
      knocks: [{ guess: "quán cà phê", correct: false, at: phut(-1) }],
    });
  });

  it("lan thu tren niem phong khong phai cau do khong bao gio toi tay chu sach hay nguoi kia", async () => {
    const s = await haiCuon();
    const id = (await dangTo(s, TRAO_DOI, toKhoa("He", biMat(1))))!;
    await s.db.insert(sealAttempts).values({ sealId: id, accountId: s.seat2.id, guess: "LOGUESS", correct: true, at: NOW });
    const chu = (await readBook(s.db, s.seat1.id, s.chung, NOW))!;
    expect(chu.seals[0]).toMatchObject({ knocks: [], answerCount: null, hints: [] });
    expect(JSON.stringify(chu)).not.toContain("LOGUESS");
    const kia = JSON.stringify(await readBook(s.db, s.seat2.id, s.chung, NOW));
    expect(kia).not.toContain("LOGUESS");
    expect(kia).not.toContain(biMat(1));
  });

  it("lan tra loi dung khong phai cua nguoi kia thi khong cho nguoi kia nghi thuc", async () => {
    const s = await haiCuon();
    const id = (await dangTo(s, CAU_DO, toKhoa("He", biMat(1))))!;
    await s.db.insert(sealAttempts).values({ sealId: id, accountId: s.seat1.id, guess: "x", correct: true, at: NOW });
    await s.db.update(seals).set({ openedAt: NOW }).where(eq(seals.id, id));
    expect((await readBook(s.db, s.seat2.id, s.chung, NOW))!.seals[0].ritual).toBe(false);
  });

  it("da mo thi nguoi kia doc duoc chu that", async () => {
    const { db, seat2, chung, sealId } = await sachCoKhoa(CAU_DO);
    await db.update(seals).set({ openedAt: phut(-1) }).where(eq(seals.id, sealId));
    const view = await readBook(db, seat2.id, chung, NOW);
    expect(view!.sheets.every((s) => !s.locked)).toBe(true);
    expect(JSON.stringify(view)).toContain(BI_MAT);
  });

  it("hen gio khoa ca chu sach truoc gio mo, mo cho ca hai tu dung gio mo", async () => {
    const { db, seat1, seat2, chung } = await sachCoKhoa(henGio(phut(60)));
    for (const ai of [seat1.id, seat2.id]) {
      const truoc = await readBook(db, ai, chung, NOW);
      expect(truoc!.sheets[1].locked).toBe(true);
      expect(JSON.stringify(truoc)).not.toContain(BI_MAT);
      const sau = await readBook(db, ai, chung, phut(60));
      expect(sau!.sheets[1].locked).toBe(false);
    }
  });

  it("trao doi chua gui thi khong co trang tra loi; da gui thi ca hai nguoi doc duoc", async () => {
    const { db, seat1, seat2, chung, sealId } = await sachCoKhoa(TRAO_DOI);
    expect((await readBook(db, seat1.id, chung, NOW))!.seals[0].reply).toBeNull();
    await db.insert(sealReplies).values({ sealId, accountId: seat2.id, content: to("Em nghĩ về anh") });
    await db.update(seals).set({ openedAt: phut(-1) }).where(eq(seals.id, sealId));
    for (const ai of [seat1.id, seat2.id]) {
      const view = await readBook(db, ai, chung, NOW);
      expect(JSON.stringify(view!.seals[0].reply)).toContain("Em nghĩ về anh");
    }
  });

  it("moc mo: chua mo thi null; mo roi thi ca chu sach lan nguoi kia deu biet luc mo", async () => {
    const { db, seat1, seat2, chung, sealId } = await sachCoKhoa(CAU_DO);
    expect((await readBook(db, seat2.id, chung, NOW))!.seals[0].openedAt).toBeNull();
    await db.update(seals).set({ openedAt: phut(-1) }).where(eq(seals.id, sealId));
    for (const ai of [seat1.id, seat2.id]) {
      expect((await readBook(db, ai, chung, NOW))!.seals[0].openedAt).toEqual(phut(-1));
    }
  });

  it("nghi thuc chi khi chinh nguoi kia tu mo va con trong 2 phut; chu sach thi khong", async () => {
    const { db, seat1, seat2, chung, sealId } = await sachCoKhoa(CAU_DO);
    await db.insert(sealAttempts).values({ sealId, accountId: seat2.id, guess: "ben xe mien dong", correct: true, at: NOW });
    await db.update(seals).set({ openedAt: NOW }).where(eq(seals.id, sealId));
    expect((await readBook(db, seat2.id, chung, phut(1)))!.seals[0].ritual).toBe(true);
    expect((await readBook(db, seat2.id, chung, phut(3)))!.seals[0].ritual).toBe(false);
    expect((await readBook(db, seat1.id, chung, phut(1)))!.seals[0].ritual).toBe(false);
  });

  it("tang chia khoa thi khong co nghi thuc; gui trang tra loi thi co", async () => {
    const tang = await sachCoKhoa(CAU_DO);
    await tang.db.update(seals).set({ openedAt: NOW, giftNote: "Cho em" }).where(eq(seals.id, tang.sealId));
    expect((await readBook(tang.db, tang.seat2.id, tang.chung, phut(1)))!.seals[0].ritual).toBe(false);
    const tra = await sachCoKhoa(TRAO_DOI);
    await tra.db.insert(sealReplies).values({ sealId: tra.sealId, accountId: tra.seat2.id, content: to("Tra loi") });
    await tra.db.update(seals).set({ openedAt: NOW }).where(eq(seals.id, tra.sealId));
    expect((await readBook(tra.db, tra.seat2.id, tra.chung, phut(1)))!.seals[0].ritual).toBe(true);
  });

  it("to dau cua niem phong khong co chu thi dong he lo la null, ca o man doc lan tren ke", async () => {
    const s = await haiCuon();
    const trong: DocJson = { type: "doc", content: [{ type: "paragraph" }] };
    await dangTo(s, CAU_DO, trong, toKhoa("chu", biMat(2)));
    const view = (await readBook(s.db, s.seat2.id, s.chung, NOW))!;
    const ke = (await listShelf(s.db, s.seat2.id, NOW)).find((b) => b.id === s.chung)!;
    expect([view.sheets.map((x) => x.teaser), ke.excerpt]).toEqual([[null, null], null]);
    expect(JSON.stringify([view, ke])).not.toContain(biMat(2));
  });
});

describe("markRead khong vuot qua to dang khoa", () => {
  it("moc da doc dung ngay truoc to khoa dau tien, mo roi thi day tiep duoc", async () => {
    const { db, seat2, chung, sealId } = await sachCoKhoa(CAU_DO);
    const moc = async () =>
      (await db.select().from(readMarks).where(and(eq(readMarks.accountId, seat2.id), eq(readMarks.bookId, chung))))[0]?.position;
    await markRead(db, seat2.id, chung, 3, NOW);
    expect(await moc()).toBe(1);
    await db.update(seals).set({ openedAt: phut(-1) }).where(eq(seals.id, sealId));
    await markRead(db, seat2.id, chung, 3, NOW);
    expect(await moc()).toBe(3);
  });

  it("vi tri vuot to cuoi bi kep ve to cuoi va moc khong bao gio lui", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "mot", "hai", "ba");
    await markRead(s.db, s.seat2.id, s.chung, 99, NOW);
    expect(await mocCua(s)).toBe(3);
    await markRead(s.db, s.seat2.id, s.chung, 1, NOW);
    expect(await mocCua(s)).toBe(3);
    const view = (await readBook(s.db, s.seat2.id, s.chung, NOW))!;
    expect(view.sheets.map((x) => x.content)).toEqual([to("mot"), to("hai"), to("ba")]);
    expect(view.seals).toEqual([]);
    expect(view.mark).toBe(3);
    const ke = (await listShelf(s.db, s.seat2.id, NOW)).find((b) => b.id === s.chung)!;
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    expect(ke).toMatchObject({ pageCount: 3, newCount: 0, lockedCount: 0 });
    expect(ke.excerpt).toBe(["mot", "hai", "ba"][ke.excerptPosition - 1]);
  });

  it("niem phong ngay to dau: khong bao gio ghi moc, ke ca khi co to mo dang sau; ca cuon khoa", async () => {
    const s = await haiCuon();
    await dangTo(s, CAU_DO, toKhoa("He lo dau", biMat(1)), toKhoa("to hai", biMat(2)));
    let ke = (await listShelf(s.db, s.seat2.id, NOW)).find((b) => b.id === s.chung)!;
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    // Ca cuon khoa nen khong co to nao chon duoc: giu dong he lo cua to cuoi.
    expect(ke).toMatchObject({ excerpt: "He lo dau", excerptPosition: 2, excerptLocked: true, lockedCount: 2, newCount: 2 });
    await markRead(s.db, s.seat2.id, s.chung, 1, NOW);
    await markRead(s.db, s.seat2.id, s.chung, 2, NOW);
    expect(await mocCua(s)).toBeUndefined();
    await dang(s.db, s.seat1.id, s.chung, "mo ba");
    await markRead(s.db, s.seat2.id, s.chung, 3, NOW);
    expect(await mocCua(s)).toBeUndefined();
    ke = (await listShelf(s.db, s.seat2.id, NOW)).find((b) => b.id === s.chung)!;
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    // Nguoi kia chua co dau doc nen khong co ung vien; to doc duoc dau tien co chu la to 3.
    expect(ke).toMatchObject({ excerpt: "mo ba", excerptPosition: 3, excerptLocked: false, lockedCount: 2, newCount: 3 });
    const json = JSON.stringify([await readBook(s.db, s.seat2.id, s.chung, NOW), ke]);
    for (const i of [1, 2]) expect(json).not.toContain(biMat(i));
  });

  it("hai niem phong lien nhau, cai dau da mo, cai sau con khoa: moc dung truoc cai sau; to khoa o giua van tinh la to moi", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "mo mot");
    const a = await dangTo(s, CAU_DO, toKhoa("He A", biMat(2)), toKhoa("A2", biMat(3)));
    const b = await dangTo(s, TRAO_DOI, toKhoa("He B", biMat(4)), toKhoa("B2", biMat(5)));
    await s.db.update(seals).set({ openedAt: phut(-10), giftNote: "qua" }).where(eq(seals.id, a!));
    let view = (await readBook(s.db, s.seat2.id, s.chung, NOW))!;
    expect(view.sheets.map((x) => [x.position, x.locked, x.sealId === a, x.sealId === b, x.teaser])).toEqual([
      [1, false, false, false, null], [2, false, true, false, null], [3, false, true, false, null],
      [4, true, false, true, "He B"], [5, true, false, true, null],
    ]);
    expect(view.seals.map((x) => [x.locked, x.giftNote, x.ritual, x.hints])).toEqual([[false, "qua", false, []], [true, null, false, []]]);
    let json = JSON.stringify(view);
    expect(json).toContain(biMat(2));
    for (const i of [4, 5]) expect(json).not.toContain(biMat(i));
    expect(json).not.toContain("B2");
    for (const p of [3, 4, 5, 99]) await markRead(s.db, s.seat2.id, s.chung, p, NOW);
    expect(await mocCua(s)).toBe(3);
    await dang(s.db, s.seat1.id, s.chung, "mo sau");
    const ke = (await listShelf(s.db, s.seat2.id, NOW)).find((x) => x.id === s.chung)!;
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    // Dau doc la 3 nen chi to 1-3 la ung vien: to 4, 5 con khoa, to 6 chua doc.
    expect(ke).toMatchObject({ lockedCount: 2, newCount: 3, pageCount: 6, excerptLocked: false });
    const chuTo: Record<number, string> = { 1: "mo mot", 2: `He A ${biMat(2)}`, 3: `A2 ${biMat(3)}` };
    expect(ke.excerpt).toBe(chuTo[ke.excerptPosition]);
    await s.db.insert(sealReplies).values({ sealId: b!, accountId: s.seat2.id, content: to("tra loi") });
    await s.db.update(seals).set({ openedAt: NOW }).where(eq(seals.id, b!));
    await markRead(s.db, s.seat2.id, s.chung, 6, NOW);
    expect(await mocCua(s)).toBe(6);
    view = (await readBook(s.db, s.seat2.id, s.chung, ms(RITUAL_WINDOW_MS)))!;
    expect(view.seals[1].ritual).toBe(true);
    expect((await readBook(s.db, s.seat2.id, s.chung, ms(RITUAL_WINDOW_MS + 1)))!.seals[1].ritual).toBe(false);
    expect((await readBook(s.db, s.seat1.id, s.chung, NOW))!.seals[1].ritual).toBe(false);
    json = JSON.stringify(view);
    expect(json).toContain(biMat(5));
  });

  it("hen gio: khoa ca chu sach, moc bi kep toi dung gio mo, mo tu dung opensAt, khong co nghi thuc; sach rieng tu vo hinh", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "mo");
    await dangTo(s, henGio(phut(60)), toKhoa("He T", biMat(2)), toKhoa("T2", biMat(3)));
    const cuaChu = (await readBook(s.db, s.seat1.id, s.chung, NOW))!;
    expect(cuaChu.sheets.map((x) => x.locked)).toEqual([false, true, true]);
    const keChu = (await listShelf(s.db, s.seat1.id, NOW)).find((b) => b.id === s.chung)!;
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    // Hen gio khoa ca chu sach: to 1 la ung vien duy nhat.
    expect(keChu).toMatchObject({ excerpt: "mo", excerptPosition: 1, excerptLocked: false, lockedCount: 2, newCount: 0 });
    expect(JSON.stringify([cuaChu, keChu])).not.toContain(biMat(2));
    await markRead(s.db, s.seat2.id, s.chung, 3, phut(60));
    expect(await mocCua(s)).toBe(3);
    const s2 = await haiCuon();
    await dang(s2.db, s2.seat1.id, s2.chung, "mo");
    await dangTo(s2, henGio(phut(60)), toKhoa("He T", biMat(2)));
    await markRead(s2.db, s2.seat2.id, s2.chung, 2, ms(3_600_000 - 1));
    expect(await mocCua(s2)).toBe(1);
    const dungGio = (await readBook(s2.db, s2.seat2.id, s2.chung, phut(60)))!;
    expect(dungGio.sheets[1].locked).toBe(false);
    expect(dungGio.seals[0]).toMatchObject({ ritual: false, openedAt: null });
    await publishDraft(s2.db, s2.seat1.id, s2.rieng, [toKhoa("rieng", biMat(9))], henGio(phut(60)));
    expect(await readBook(s2.db, s2.seat2.id, s2.rieng, NOW)).toBeNull();
    expect((await listShelf(s2.db, s2.seat2.id, NOW)).some((b) => b.id === s2.rieng)).toBe(false);
    await markRead(s2.db, s2.seat2.id, s2.rieng, 1, phut(90));
    expect(await s2.db.select().from(readMarks).where(eq(readMarks.bookId, s2.rieng))).toHaveLength(0);
  });
});

describe("listShelf voi to khoa", () => {
  it("nguoi kia thay so to khoa; doan trich la to mo duy nhat, khong bao gio chu that cua to khoa", async () => {
    const { db, seat2, chung } = await sachCoKhoa(CAU_DO);
    const shelf = await listShelf(db, seat2.id, NOW);
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    expect(shelf.find((b) => b.id === chung)).toMatchObject({
      pageCount: 3, newCount: 3, lockedCount: 2, excerpt: "Tờ mở", excerptPosition: 1, excerptLocked: false,
    });
    expect(JSON.stringify(shelf)).not.toContain(BI_MAT);
  });

  it("chu sach khong bi khoa boi cau do cua minh, nhung bi khoa boi hen gio", async () => {
    const a = await sachCoKhoa(CAU_DO);
    expect((await listShelf(a.db, a.seat1.id, NOW)).find((b) => b.id === a.chung)!.lockedCount).toBe(0);
    const b = await sachCoKhoa(henGio(phut(60)));
    expect((await listShelf(b.db, b.seat1.id, NOW)).find((x) => x.id === b.chung)!.lockedCount).toBe(2);
  });

  it("excerptLocked: chi khi khong co to nao chon duoc va to cuoi con khoa", async () => {
    const khoaCua = async (s: Bo, ai: string, luc: Date) => (await listShelf(s.db, ai, luc)).find((b) => b.id === s.chung)!;

    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    // Cau do: to 1 mo nen khong ai thay dong he lo tren ke; nguoi kia chua doc gi nen la to doc duoc dau tien (to 1).
    const cauDo = await sachCoKhoa(CAU_DO);
    expect(await khoaCua(cauDo, cauDo.seat2.id, NOW)).toMatchObject({ excerptLocked: false, excerptPosition: 1, excerpt: "Tờ mở" });
    expect((await khoaCua(cauDo, cauDo.seat1.id, NOW)).excerptLocked).toBe(false);

    // Hen gio: khoa ca chu sach toi dung gio mo; tu gio mo tro di to 2 vao tap ung vien.
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "mo");
    await dangTo(s, henGio(phut(60)), toKhoa("He T", biMat(2)));
    for (const ai of [s.seat1.id, s.seat2.id]) {
      expect(await khoaCua(s, ai, NOW)).toMatchObject({ excerptLocked: false, excerptPosition: 1, excerpt: "mo" });
      const denGio = await khoaCua(s, ai, phut(60));
      expect(denGio.excerptLocked).toBe(false);
      expect(denGio.excerpt).toBe(denGio.excerptPosition === 1 ? "mo" : `He T ${biMat(2)}`);
    }

    // Nguoi kia chua co dau doc: van la to doc duoc dau tien co chu, niem phong con khoa khong lo chu that.
    await dang(s.db, s.seat1.id, s.chung, "mo sau");
    expect(await khoaCua(s, s.seat2.id, NOW)).toMatchObject({ excerptLocked: false, excerptPosition: 1, excerpt: "mo", lockedCount: 1 });
    expect(JSON.stringify(await listShelf(s.db, s.seat2.id, NOW))).not.toContain(biMat(2));

    // Moi to deu khoa: khong co ung vien, doan trich la dong he lo cua to cuoi. Dat cuoi ca vi haiCuon() xoa sach du lieu.
    const tatCa = await haiCuon();
    await dangTo(tatCa, henGio(phut(60)), toKhoa("He T", biMat(2)));
    expect(await khoaCua(tatCa, tatCa.seat2.id, NOW)).toMatchObject({ excerptLocked: true, excerptPosition: 1, excerpt: "He T" });
  });

  it("chi lo cuoi bi niem phong: doan trich la mot to mo, to sau cua niem phong la doan trong", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "mo mot", "mo hai");
    await dangTo(s, CAU_DO, toKhoa("He lo A", biMat(3)), toKhoa("Sau A", biMat(4)));
    const view = (await readBook(s.db, s.seat2.id, s.chung, NOW))!;
    expect(view.sheets[3].content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(view.sheets[2].content).toEqual(to("He lo A"));
    const ke = (await listShelf(s.db, s.seat2.id, NOW)).find((b) => b.id === s.chung)!;
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    // Nguoi kia chua doc gi: to doc duoc dau tien.
    expect(ke).toMatchObject({ pageCount: 4, newCount: 4, lockedCount: 2, excerptLocked: false, excerptPosition: 1, excerpt: "mo mot" });
    const json = JSON.stringify([view, ke]);
    for (const i of [3, 4]) expect(json).not.toContain(biMat(i));
    expect(json).not.toContain("Sau A");
  });
});

const ANH_CHUP = { isolationLevel: "repeatable read", accessMode: "read only" };

/**
 * Boc db de chung minh moi lan doc di qua mot anh chup. PGlite chi co mot ket noi
 * nen khong dung lai duoc cuoc dua that; thay vao do moi cach doc hay ghi thang tren db deu nem loi, chi
 * `transaction` duoc chuyen tiep toi db that va ghi lai cau hinh. Cac cau lenh ben trong giao dich chay tren tx
 * that. `choPhep` mo rieng tung cua, vi du "insert" cho lenh ghi moc cua markRead.
 */
function chiQuaAnhChup(db: TestDb, ...choPhep: string[]) {
  const cauHinh: unknown[] = [];
  const cam = new Set(["select", "selectDistinct", "selectDistinctOn", "execute", "query", "insert", "update", "delete", "with", "$with", "$count"]);
  const boc = new Proxy(db, {
    get(goc, ten) {
      if (ten === "transaction") {
        return (fn: Parameters<TestDb["transaction"]>[0], config?: Parameters<TestDb["transaction"]>[1]) => {
          cauHinh.push(config);
          return goc.transaction(fn, config);
        };
      }
      if (typeof ten === "string" && cam.has(ten) && !choPhep.includes(ten)) throw new Error(`doc ngoai anh chup: db.${ten}`);
      const v = Reflect.get(goc, ten, goc);
      return typeof v === "function" ? v.bind(goc) : v;
    },
  });
  return { boc, cauHinh };
}

describe("doc tren mot anh chup", () => {
  it("readSnapshot la giao dich repeatable read chi doc that tren database", async () => {
    const { db } = await haiCuon();
    const r = await readSnapshot(db, (tx) =>
      tx.execute(sql`select current_setting('transaction_isolation') as muc, current_setting('transaction_read_only') as chi_doc`),
    );
    expect(r.rows[0]).toEqual({ muc: "repeatable read", chi_doc: "on" });
    const loi = await readSnapshot(db, (tx) => tx.execute(sql`update books set title = title`)).then(() => null, (e: unknown) => e);
    expect(String((loi as { cause?: unknown } | null)?.cause ?? loi)).toMatch(/read-only transaction/);
  });

  it("readSnapshot tu choi giao dich dang chay thay vi lang le mat anh chup", async () => {
    const { db } = await haiCuon();
    await expect(db.transaction((tx) => readSnapshot(tx, async () => 1))).rejects.toThrow(/giao dich dang chay/);
  });

  it("readBook doc sach, to, moc, niem phong, lan thu va trang tra loi trong mot anh chup; ket qua giong het", async () => {
    const s = await sachCoKhoa(CAU_DO);
    await s.db.insert(sealAttempts).values({ sealId: s.sealId, accountId: s.seat2.id, guess: "quán cà phê", correct: false, at: phut(-1) });
    const traoDoi = (await dangTo(s, TRAO_DOI, toKhoa("Tờ bốn", biMat(4))))!;
    await s.db.insert(sealReplies).values({ sealId: traoDoi, accountId: s.seat2.id, content: to("Em nghĩ về anh") });
    await s.db.update(seals).set({ openedAt: phut(-1) }).where(eq(seals.id, traoDoi));
    await markRead(s.db, s.seat2.id, s.chung, 1, NOW);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      const { boc, cauHinh } = chiQuaAnhChup(s.db);
      const view = await readBook(boc, ai, s.chung, NOW);
      expect(cauHinh).toEqual([ANH_CHUP]);
      expect(view).toEqual(await readBook(s.db, ai, s.chung, NOW));
      expect(JSON.stringify(view)).toContain("Em nghĩ về anh");
      if (ai === s.seat1.id) expect(JSON.stringify(view)).toContain("quán cà phê");
      else expect(view!.seals[0].remaining).toBe(4);
    }
    const { boc, cauHinh } = chiQuaAnhChup(s.db);
    expect(await readBook(boc, s.seat2.id, s.rieng, NOW)).toBeNull();
    expect(cauHinh).toEqual([ANH_CHUP]);
  });

  it("listShelf doc sach, thong ke, moc, to cuoi va niem phong trong mot anh chup; ket qua giong het", async () => {
    const s = await sachCoKhoa(CAU_DO);
    await markRead(s.db, s.seat2.id, s.chung, 1, NOW);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      const { boc, cauHinh } = chiQuaAnhChup(s.db);
      const shelf = await listShelf(boc, ai, NOW);
      expect(cauHinh).toEqual([ANH_CHUP]);
      expect(shelf).toEqual(await listShelf(s.db, ai, NOW));
    }
  });

  it("markRead tinh tran va ghi moc trong cung mot giao dich, khong lenh nao nam ngoai", async () => {
    const s = await sachCoKhoa(CAU_DO);
    const { boc, cauHinh } = chiQuaAnhChup(s.db);
    await markRead(boc, s.seat2.id, s.chung, 3, NOW);
    // Giao dich thuong (khong phai anh chup chi doc): lenh ghi moc nam ben trong, tran tinh tren cung trang thai vi tri.
    expect(cauHinh).toEqual([undefined]);
    expect(await mocCua(s)).toBe(1);
  });
});

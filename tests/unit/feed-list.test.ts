import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { activity, activitySeen, bookCovers, books, bookTracks, moods, sealAttempts, seals } from "@/server/db/schema";
import { FEED_LIMIT, listActivity } from "@/server/feed/list";
import { setAnHoatDong } from "@/server/identity/prefs";
import { recordActivity } from "@/server/feed/record";
import type { BookMode } from "@/lib/book";
import { dayKey } from "@/lib/when";
import { DONG_MAC_DINH } from "../helpers/feed";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

const NOW = new Date("2026-09-15T08:00:00.000Z");
const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

/**
 * Hai cho ngoi, seat1 co mot cuon chia se va mot cuon rieng tu. Moi to can dung la mot luot ghi thang (to 1-2 cua cuon
 * chia se chung mot luot), mot cau do o to 5 cuon chia se, mot hen gio o to 3-4 cuon rieng tu. Niem phong ghi thang
 * vao bang, khong qua publishDraft, de moi ca chi thay dung cac su kien no tu ghi.
 */
async function ke() {
  const s = await haiCuon();
  const luot = new Map<string, string>();
  const them = async (bookId: string, first: number, last = first) => {
    const id = await luotChu(s.db, bookId, first, last);
    for (let p = first; p <= last; p++) luot.set(`${bookId}:${p}`, id);
  };
  await them(s.chung, 1, 2);
  for (let p = 3; p <= FEED_LIMIT + 1; p++) await them(s.chung, p);
  await them(s.rieng, 1);
  await them(s.rieng, 2);
  await them(s.rieng, 3, 4);
  await them(s.rieng, 10);
  // Cac dong tao-sach do haiCuon ghi ra khong thuoc cac bai nay: moi ca chi thay dung su kien no tu ghi.
  await s.db.delete(activity);
  const luotCua = (bookId: string, position: number): string => {
    const id = luot.get(`${bookId}:${position}`);
    if (!id) throw new Error(`chua dung luot cho to ${position}`);
    return id;
  };
  const [cauDo] = await s.db
    .insert(seals)
    .values({ bookId: s.chung, roundId: luotCua(s.chung, 5), kind: "cau-do", question: "Ở đâu?", answers: ["ben xe"], teaser: "" })
    .returning({ id: seals.id });
  const [henGio] = await s.db
    .insert(seals)
    .values({ bookId: s.rieng, roundId: luotCua(s.rieng, 3), kind: "hen-gio", opensAt: phut(30), teaser: "" })
    .returning({ id: seals.id });
  /** Phan chung cua mot su kien gan sach: luot la luot chua to position. */
  const tren = (actorId: string, bookId: string, mode: BookMode, at: Date, position = 1) =>
    ({ actorId, bookId, mode, at, roundId: luotCua(bookId, position) });
  return { ...s, cauDo: cauDo.id, henGio: henGio.id, luotCua, tren };
}

describe("listActivity: ai thay gi", () => {
  it("trang moi cua sach chia se: ca hai cung thay, by theo nguoi xem, ten sach join luc doc", async () => {
    const { db, seat1, seat2, chung, tren } = await ke();
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-10)), kind: "dang-trang", sealId: null });
    const cuaChu = {
      ...DONG_MAC_DINH, id: expect.any(String), kind: "dang-trang", at: phut(-10), bookId: chung, bookTitle: "Chuyện chưa kể",
      firstPosition: 1, lastPosition: 2, sealKind: null, note: null, count: 1,
    };
    expect(await listActivity(db, seat1.id, NOW)).toEqual([{ ...cuaChu, by: "me" }]);
    expect(await listActivity(db, seat2.id, NOW)).toEqual([{ ...cuaChu, by: "partner", isNew: true }]);
  });

  it("hoi-dap: chu sach va nguoi hoi dap deu thay, khoang to cua luot, khong chip; sach chuyen rieng tu thi chi chu sach thay", async () => {
    const { db, seat1, seat2, chung, tren } = await ke();
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-1)), kind: "hoi-dap", sealId: null });
    const dong = (ds: Awaited<ReturnType<typeof listActivity>>) => ds.map((i) => [i.kind, i.by, i.firstPosition, i.lastPosition, i.sealKind]);
    expect(dong(await listActivity(db, seat1.id, NOW))).toEqual([["hoi-dap", "partner", 1, 2, null]]);
    expect(dong(await listActivity(db, seat2.id, NOW))).toEqual([["hoi-dap", "me", 1, 2, null]]);
    await db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, chung));
    expect(await listActivity(db, seat2.id, NOW)).toEqual([]);
    expect(await listActivity(db, seat1.id, NOW)).toHaveLength(1);
  });

  it("sach rieng tu: nguoi kia khong thay gi, ke ca hen gio da toi gio; chu sach thay het", async () => {
    const { db, seat1, seat2, rieng, henGio, tren } = await ke();
    await recordActivity(db, { ...tren(seat1.id, rieng, "rieng-tu", phut(-60), 3), kind: "dang-trang", sealId: henGio });
    await recordActivity(db, { ...tren(seat1.id, rieng, "rieng-tu", phut(30), 3), kind: "mo-hen-gio", sealId: henGio });
    expect(await listActivity(db, seat2.id, phut(31))).toEqual([]);
    expect((await listActivity(db, seat1.id, phut(31))).map((i) => [i.kind, i.bookTitle, i.sealKind])).toEqual([
      ["mo-hen-gio", "Cuốn không đặt tên", "hen-gio"], ["dang-trang", "Cuốn không đặt tên", "hen-gio"],
    ]);
  });

  it("chia se roi chuyen rieng tu: moi su kien cu bien mat voi nguoi kia, ke ca tang chia khoa va loi nhan", async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    await db.update(seals).set({ openedAt: phut(-5), giftNote: "Cho em nè" }).where(eq(seals.id, cauDo));
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-20), 5), kind: "dang-trang", sealId: cauDo });
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-5), 5), kind: "tang-khoa", sealId: cauDo });
    expect((await listActivity(db, seat2.id, NOW)).map((i) => [i.kind, i.note])).toEqual([["tang-khoa", "Cho em nè"], ["dang-trang", null]]);

    await db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, chung));
    const cuaNguoiKia = await listActivity(db, seat2.id, NOW);
    expect(cuaNguoiKia).toEqual([]);
    expect(JSON.stringify(cuaNguoiKia)).not.toContain("Cho em");
    expect(await listActivity(db, seat1.id, NOW)).toHaveLength(2);
  });

  it("rieng tu roi chuyen chia se: su kien luc con rieng tu kin mai, su kien sau khi chia se thi hien", async () => {
    const { db, seat1, seat2, rieng, tren } = await ke();
    await recordActivity(db, { ...tren(seat1.id, rieng, "rieng-tu", phut(-20), 1), kind: "dang-trang", sealId: null });
    await db.update(books).set({ mode: "chia-se" }).where(eq(books.id, rieng));
    await recordActivity(db, { ...tren(seat1.id, rieng, "chia-se", phut(-5), 2), kind: "dang-trang", sealId: null });
    expect((await listActivity(db, seat2.id, NOW)).map((i) => i.firstPosition)).toEqual([2]);
    expect((await listActivity(db, seat1.id, NOW)).map((i) => i.firstPosition)).toEqual([2, 1]);
  });

  it("thu-sai chi chu sach thay, gom theo ngay; mo-trang thi ca hai thay", async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    for (const at of [phut(-30), phut(-20), phut(-10)]) {
      await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", at, 5), kind: "thu-sai", sealId: cauDo });
    }
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-1), 5), kind: "mo-trang", sealId: cauDo });
    expect((await listActivity(db, seat1.id, NOW)).map((i) => [i.kind, i.by, i.count, i.at])).toEqual([
      ["mo-trang", "partner", 1, phut(-1)], ["thu-sai", "partner", 3, phut(-10)],
    ]);
    expect((await listActivity(db, seat2.id, NOW)).map((i) => [i.kind, i.by, i.sealKind])).toEqual([["mo-trang", "me", "cau-do"]]);
  });

  it("doi-mat-khau: nguoi doi va nguoi bi doi deu thay, khong gan sach", async () => {
    const { db, seat1, seat2 } = await ke();
    await recordActivity(db, { kind: "doi-mat-khau", actorId: seat2.id, subjectId: seat1.id, at: phut(-3) });
    const dong = {
      ...DONG_MAC_DINH, id: expect.any(String), kind: "doi-mat-khau", at: phut(-3), bookId: null, bookTitle: null,
      firstPosition: null, lastPosition: null, sealKind: null, note: null, count: 1,
    };
    expect(await listActivity(db, seat1.id, NOW)).toEqual([{ ...dong, by: "partner", isNew: true }]);
    expect(await listActivity(db, seat2.id, NOW)).toEqual([{ ...dong, by: "me" }]);
  });

  it("mo-hen-gio ghi san o tuong lai chi hien khi now da toi opensAt, voi ca hai nguoi", async () => {
    const { db, seat1, seat2, chung, tren, luotCua } = await ke();
    const [hen] = await db
      .insert(seals)
      .values({ bookId: chung, roundId: luotCua(chung, 7), kind: "hen-gio", opensAt: phut(30), teaser: "" })
      .returning({ id: seals.id });
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(30), 7), kind: "mo-hen-gio", sealId: hen.id });
    for (const nguoi of [seat1.id, seat2.id]) {
      expect(await listActivity(db, nguoi, NOW)).toEqual([]);
      expect(await listActivity(db, nguoi, new Date(phut(30).getTime() - 1))).toEqual([]);
      expect((await listActivity(db, nguoi, phut(30))).map((i) => i.kind)).toEqual(["mo-hen-gio"]);
    }
  });
});

describe("listActivity: gom thu sai trong SQL", () => {
  it("ngay gio Viet Nam cua SQL khop dayKey o ca hai phia nua dem: 16:59:59Z va 17:00:00Z la hai dong", async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    // Ca bon lan cung mot ngay UTC; gom theo ngay UTC hay lech mui gio mot gio deu ra mot dong 4 lan.
    const cacLan = ["2026-09-14T16:00:00.000Z", "2026-09-14T16:59:59.000Z", "2026-09-14T17:00:00.000Z", "2026-09-14T17:30:00.000Z"]
      .map((iso) => new Date(iso));
    for (const at of cacLan) {
      await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", at, 5), kind: "thu-sai", sealId: cauDo });
    }
    expect(cacLan.map(dayKey)).toEqual(["2026-09-14", "2026-09-14", "2026-09-15", "2026-09-15"]);
    expect((await listActivity(db, seat1.id, NOW)).map((i) => [dayKey(i.at), i.count, i.at])).toEqual([
      ["2026-09-15", 2, cacLan[3]], ["2026-09-14", 2, cacLan[1]],
    ]);
  });

  it("khac niem phong thi tach dong; dong gom mang id cua lan thu dau tien, them lan thu khong doi id", async () => {
    const { db, seat1, seat2, chung, cauDo, tren, luotCua } = await ke();
    const [khac] = await db
      .insert(seals)
      .values({ bookId: chung, roundId: luotCua(chung, 6), kind: "cau-do", question: "Ai?", answers: ["em"], teaser: "" })
      .returning({ id: seals.id });
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-30), 5), kind: "thu-sai", sealId: cauDo });
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-20), 6), kind: "thu-sai", sealId: khac.id });
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-10), 5), kind: "thu-sai", sealId: cauDo });
    const [dauTien] = await db.select({ id: activity.id }).from(activity).where(eq(activity.at, phut(-30)));
    const truoc = await listActivity(db, seat1.id, NOW);
    expect(truoc.map((i) => [i.firstPosition, i.count, i.at])).toEqual([[5, 2, phut(-10)], [6, 1, phut(-20)]]);
    expect(truoc[0].id).toBe(dauTien.id);

    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-5), 5), kind: "thu-sai", sealId: cauDo });
    expect((await listActivity(db, seat1.id, NOW)).map((i) => [i.id, i.count])).toEqual([[dauTien.id, 3], [truoc[1].id, 1]]);
  });

  it(`${FEED_LIMIT} dong tinh sau khi gom: ${FEED_LIMIT + 5} lan thu sai khong day mat dong doi mat khau cu hon`, async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    // seat2 doi mat khau cua seat1 (chu sach), roi doan sai cau do cua seat1 ca buoi.
    await recordActivity(db, { kind: "doi-mat-khau", actorId: seat2.id, subjectId: seat1.id, at: phut(-(FEED_LIMIT + 30)) });
    for (let i = 1; i <= FEED_LIMIT + 5; i++) {
      await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-i), 5), kind: "thu-sai", sealId: cauDo });
    }
    expect((await listActivity(db, seat1.id, NOW)).map((i) => [i.kind, i.by, i.count])).toEqual([
      ["thu-sai", "partner", FEED_LIMIT + 5], ["doi-mat-khau", "partner", 1],
    ]);
    expect((await listActivity(db, seat2.id, NOW)).map((i) => [i.kind, i.by, i.count])).toEqual([["doi-mat-khau", "me", 1]]);
  });
});

describe("listActivity: du lieu tra ve", () => {
  it("ten sach doc luc doc; loi nhan chi o tang-khoa, moi loai khac luon null", async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    await db.update(seals).set({ openedAt: phut(-5), giftNote: "Cho em nè" }).where(eq(seals.id, cauDo));
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-40), 5), kind: "dang-trang", sealId: cauDo });
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-30), 5), kind: "thu-sai", sealId: cauDo });
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-20), 5), kind: "moi-trao-doi", sealId: cauDo });
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-10), 5), kind: "mo-trang", sealId: cauDo });
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-5), 5), kind: "tang-khoa", sealId: cauDo });
    await db.update(books).set({ title: "Tên mới" }).where(eq(books.id, chung));
    const items = await listActivity(db, seat1.id, NOW);
    expect(items.map((i) => [i.kind, i.note])).toEqual([
      ["tang-khoa", "Cho em nè"], ["mo-trang", null], ["moi-trao-doi", null], ["thu-sai", null], ["dang-trang", null],
    ]);
    expect(items.every((i) => i.bookTitle === "Tên mới")).toBe(true);
  });

  it("tang chia khoa khong kem loi nhan thi note null", async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    await db.update(seals).set({ openedAt: phut(-5) }).where(eq(seals.id, cauDo));
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-5), 5), kind: "tang-khoa", sealId: cauDo });
    expect((await listActivity(db, seat2.id, NOW)).map((i) => i.note)).toEqual([null]);
  });

  it("khong bao gio mang id tai khoan hay chuoi da go", async () => {
    const { db, seat1, seat2, chung, cauDo, tren } = await ke();
    await db.insert(sealAttempts).values({ sealId: cauDo, accountId: seat2.id, guess: "quán cũ bí mật", correct: false, at: phut(-9) });
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-9), 5), kind: "thu-sai", sealId: cauDo });
    await recordActivity(db, { kind: "doi-mat-khau", actorId: seat2.id, subjectId: seat1.id, at: phut(-3) });
    const items = await listActivity(db, seat1.id, NOW);
    expect(items).toHaveLength(2);
    const chu = JSON.stringify(items);
    for (const lo of [seat1.id, seat2.id, cauDo, "quán cũ"]) expect(chu).not.toContain(lo);
    for (const i of items) {
      expect(Object.keys(i).sort()).toEqual(
        [
          "at", "biaMoi", "bookId", "bookTitle", "by", "count", "detail", "firstPosition", "id", "isNew", "kind", "lastPosition",
          "nhacMoi", "note", "ordinal", "sealKind", "tenLuot", "weather",
        ],
      );
    }
  });

  it("niem phong join phai cung cuon voi su kien: gan nham sealId cua cuon rieng tu khong lo sealKind/note", async () => {
    const { db, seat1, seat2, chung, rieng, tren, luotCua } = await ke();
    const [khoaRieng] = await db
      .insert(seals)
      .values({ bookId: rieng, roundId: luotCua(rieng, 10), kind: "cau-do", question: "Bí mật?", answers: ["rieng"], teaser: "" })
      .returning({ id: seals.id });
    await db.update(seals).set({ openedAt: phut(-5), giftNote: "Bí mật riêng tư" }).where(eq(seals.id, khoaRieng.id));
    // Su kien gan bookId cua cuon CHIA SE nhung sealId lai tro toi niem phong cua cuon RIENG TU: join phai loai,
    // khong duoc lo sealKind hay note cua niem phong sai cuon.
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-5), 5), kind: "tang-khoa", sealId: khoaRieng.id });
    const items = await listActivity(db, seat2.id, NOW);
    expect(items).toEqual([{
      ...DONG_MAC_DINH, id: expect.any(String), kind: "tang-khoa", by: "partner", at: phut(-5), bookId: chung,
      bookTitle: "Chuyện chưa kể", firstPosition: 5, lastPosition: 5, sealKind: null, note: null, count: 1, isNew: true,
    }]);
  });

  it(`chi doc ${FEED_LIMIT} su kien moi nhat sau khi loc theo nguoi xem`, async () => {
    const { db, seat1, seat2, chung, rieng, tren } = await ke();
    for (let i = 1; i <= FEED_LIMIT + 1; i++) {
      await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-i), i), kind: "dang-trang", sealId: null });
    }
    for (let i = 0; i < 3; i++) {
      await recordActivity(db, { ...tren(seat1.id, rieng, "rieng-tu", phut(-i / 10), i + 1), kind: "dang-trang", sealId: null });
    }
    const items = await listActivity(db, seat2.id, NOW);
    expect(items).toHaveLength(FEED_LIMIT);
    expect(items[0].at).toEqual(phut(-1));
    expect(items.at(-1)?.at).toEqual(phut(-FEED_LIMIT));
  });

  it("doc qua readSnapshot: khong nhan mot giao dich dang chay", async () => {
    const { db, seat1 } = await ke();
    await db.transaction(async (tx) => {
      await expect(listActivity(tx, seat1.id, NOW)).rejects.toThrow("readSnapshot");
    });
  });
});

describe("listActivity: bay loai cua dot nam va dau Moi", () => {
  it("tha tam trang: ca hai thay, kem kieu troi va loi nhan; thu lai thi ca hai mat dong", async () => {
    const { db, seat1, seat2 } = await ke();
    const [m] = await db.insert(moods).values({ accountId: seat2.id, weather: "mua-phun", note: "Nhớ ghê", setAt: phut(-5), endsAt: phut(600) }).returning({ id: moods.id });
    await recordActivity(db, { kind: "tha-tam-trang", actorId: seat2.id, at: phut(-5), moodId: m.id });
    const dong = (ds: Awaited<ReturnType<typeof listActivity>>) => ds.map((i) => [i.kind, i.by, i.weather, i.note, i.bookId]);
    expect(dong(await listActivity(db, seat1.id, NOW))).toEqual([["tha-tam-trang", "partner", "mua-phun", "Nhớ ghê", null]]);
    expect(dong(await listActivity(db, seat2.id, NOW))).toEqual([["tha-tam-trang", "me", "mua-phun", "Nhớ ghê", null]]);
    await db.update(moods).set({ withdrawn: true }).where(eq(moods.id, m.id));
    expect(await listActivity(db, seat1.id, NOW)).toEqual([]);
    expect(await listActivity(db, seat2.id, NOW)).toEqual([]);
  });

  it("gui thu (5b): ca hai thay, kem chi tiet thang, khong gan sach", async () => {
    const { db, seat1, seat2 } = await ke();
    await recordActivity(db, { kind: "gui-thu", actorId: seat2.id, at: phut(-4), detail: { thang: "2026-08" } });
    const dong = (ds: Awaited<ReturnType<typeof listActivity>>) => ds.map((i) => [i.kind, i.by, i.detail, i.bookId]);
    expect(dong(await listActivity(db, seat1.id, NOW))).toEqual([["gui-thu", "partner", { thang: "2026-08" }, null]]);
    expect(dong(await listActivity(db, seat2.id, NOW))).toEqual([["gui-thu", "me", { thang: "2026-08" }, null]]);
  });

  it("da doc: chi chu sach thay; nguoi doc khong thay dong ve chinh viec minh doc", async () => {
    const { db, seat1, seat2, chung, tren } = await ke();
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-2), 3), kind: "da-doc", detail: { den: 3 } });
    expect((await listActivity(db, seat1.id, NOW)).map((i) => [i.kind, i.by, i.detail])).toEqual([["da-doc", "partner", { den: 3 }]]);
    expect(await listActivity(db, seat2.id, NOW)).toEqual([]);
  });

  it("tao sach, doi ten, doi bia cua cuon rieng tu: nguoi kia khong thay, chu sach thay", async () => {
    const { db, seat1, seat2, rieng } = await ke();
    const cuon = { actorId: seat1.id, bookId: rieng, mode: "rieng-tu", at: phut(-3) } as const;
    await recordActivity(db, { ...cuon, kind: "tao-sach" });
    await recordActivity(db, { ...cuon, kind: "doi-ten-sach", detail: { truoc: "A", sau: "B" } });
    await recordActivity(db, { ...cuon, kind: "doi-bia", roundId: null, detail: { truoc: null, sau: null } });
    expect(await listActivity(db, seat2.id, NOW)).toEqual([]);
    expect((await listActivity(db, seat1.id, NOW)).map((i) => i.kind).sort()).toEqual(["doi-bia", "doi-ten-sach", "tao-sach"]);
  });

  it("dang trang: co o bia rieng thi biaMoi, co o nhac rieng thi nhacMoi", async () => {
    const { db, seat1, seat2, chung, tren, luotCua } = await ke();
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-9), 3), kind: "dang-trang", sealId: null });
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-8), 4), kind: "dang-trang", sealId: null });
    await db.insert(bookCovers).values({ bookId: chung, roundId: luotCua(chung, 3), cover: "hoa-dao", coverMediaId: null });
    await db.insert(bookTracks).values({ bookId: chung, roundId: luotCua(chung, 3), youtubeId: null });
    await db.insert(bookTracks).values({ bookId: chung, roundId: luotCua(chung, 4), youtubeId: "dQw4w9WgXcQ" });
    expect((await listActivity(db, seat2.id, NOW)).map((i) => [i.firstPosition, i.biaMoi, i.nhacMoi])).toEqual([[4, false, true], [3, true, true]]);
  });

  it("doi bia, doi nhac: so thu tu luot theo vi tri to; o mo dau la null", async () => {
    const { db, seat1, seat2, chung, luotCua } = await ke();
    const cuon = { actorId: seat1.id, bookId: chung, mode: "chia-se", detail: { truoc: null, sau: null } } as const;
    await recordActivity(db, { ...cuon, kind: "doi-bia", roundId: luotCua(chung, 7), at: phut(-3) });
    await recordActivity(db, { ...cuon, kind: "doi-nhac", roundId: null, at: phut(-2) });
    // Luot 1 gom to 1 va 2, moi to sau do la mot luot: to 7 thuoc luot thu 6.
    expect((await listActivity(db, seat2.id, NOW)).map((i) => [i.kind, i.ordinal])).toEqual([["doi-nhac", null], ["doi-bia", 6]]);
  });

  it("dau Moi: chi viec nguoi kia; da xem tai dung at thi het moi; dong gop cap nhat at thi lai moi", async () => {
    const { db, seat1, seat2, chung, tren } = await ke();
    await recordActivity(db, { ...tren(seat2.id, chung, "chia-se", phut(-9), 3), kind: "sua-trang" });
    await recordActivity(db, { ...tren(seat1.id, chung, "chia-se", phut(-8), 4), kind: "sua-trang" });
    const moi = async () => (await listActivity(db, seat1.id, NOW)).map((i) => [i.by, i.isNew]);
    expect(await moi()).toEqual([["me", false], ["partner", true]]);
    const [cuaKia] = await db.select({ id: activity.id }).from(activity).where(eq(activity.actorId, seat2.id));
    await db.insert(activitySeen).values({ accountId: seat1.id, activityId: cuaKia.id, seenAt: phut(-9) });
    expect(await moi()).toEqual([["me", false], ["partner", false]]);
    await db.update(activity).set({ at: phut(-1) }).where(eq(activity.id, cuaKia.id));
    expect(await moi()).toEqual([["partner", true], ["me", false]]);
    // Lan xem cua nguoi nay khong anh huong nguoi kia.
    expect((await listActivity(db, seat2.id, NOW)).map((i) => [i.by, i.isNew])).toEqual([["me", false], ["partner", true]]);
  });
});

/*
 * An hoat dong (06/10): dong mang dau `an` khong ra o khung Hoat dong cua AI CA, ke ca chinh nguoi lam. Luat nam o
 * thayDuoc nen cung mot dieu kien phuc vu ca listActivity, markSeen va phienBanKe.
 */
describe("an hoat dong: dong an khong ra o khung Hoat dong", () => {
  const hai = async () => {
    const s = await haiCuon();
    // Cac dong tao-sach cua buoc dung khong thuoc cac ca nay.
    await s.db.delete(activity);
    return s;
  };

  it("ca nguoi lam lan nguoi kia deu khong thay dong an", async () => {
    const s = await hai();
    await setAnHoatDong(s.db, s.seat1.id, true);
    await recordActivity(s.db, { kind: "tha-cam-xuc", actorId: s.seat1.id, at: phut(-5), detail: { cam: "yeu" } });
    expect(await listActivity(s.db, s.seat1.id, NOW)).toEqual([]);
    expect(await listActivity(s.db, s.seat2.id, NOW)).toEqual([]);
  });

  it("dong ghi TRUOC luc bat van ra binh thuong voi ca hai", async () => {
    const s = await hai();
    await recordActivity(s.db, { kind: "tha-cam-xuc", actorId: s.seat1.id, at: phut(-10), detail: { cam: "yeu" } });
    await setAnHoatDong(s.db, s.seat1.id, true);
    await recordActivity(s.db, { kind: "tha-cam-xuc", actorId: s.seat1.id, at: phut(-5), detail: { cam: "nho" } });
    expect(await listActivity(s.db, s.seat2.id, NOW)).toHaveLength(1);
    expect(await listActivity(s.db, s.seat1.id, NOW)).toHaveLength(1);
  });

  it("co cua nguoi nay khong an dong cua nguoi kia", async () => {
    const s = await hai();
    await setAnHoatDong(s.db, s.seat1.id, true);
    await recordActivity(s.db, { kind: "tha-cam-xuc", actorId: s.seat2.id, at: phut(-5), detail: { cam: "vui" } });
    expect(await listActivity(s.db, s.seat1.id, NOW)).toHaveLength(1);
  });
});

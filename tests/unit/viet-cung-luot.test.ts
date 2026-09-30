import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { activity, books, bookCovers, roundReplies, rounds } from "@/server/db/schema";
import { createBook, updateBook } from "@/server/library/books";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import { editRound, ownRoundExists, readRoundForEdit, renameRound, roundOfPosition } from "@/server/library/edit-round";
import { submitRoundReply } from "@/server/library/round-replies";
import { roundsOfBook } from "@/server/library/rounds";
import { setCoverEntry, setTrackEntry } from "@/server/library/timeline";
import { canViewMedia, recordUpload } from "@/server/media/access";
import { khoBia } from "@/server/media/cover";
import type { DocJson } from "@/lib/doc/types";
import { dang, dangTen, haiCuon, to, vietCung } from "../helpers/library";

/*
 * Luat cap luot cua sach viet cung (5c muc B2, B4, B6, H3): moi nguoi chi sua va doi ten luot cua minh; ca hai dat duoc o
 * bia, o nhac, doi chu de; anh cua cuon dung chung, anh chua dang chi nguoi tai len xem duoc; khong co hoi dap moi.
 */

const T = new Date("2026-09-21T02:00:00.000Z");
const sau = (phut: number) => new Date(T.getTime() + phut * 60_000);

/** Sach viet cung co hai luot: luot 1 cua Linh (seat1, to 1), luot 2 cua Manh (seat2, to 2). */
async function haiLuot() {
  const s = await vietCung();
  await dangTen(s.db, s.seat1.id, s.sach, "Mưa phùn đầu ngõ", "Linh viết");
  await dangTen(s.db, s.seat2.id, s.sach, "Bánh mì", "Mạnh viết");
  const [l1, l2] = await roundsOfBook(s.db, s.sach);
  return { ...s, l1, l2 };
}

const anh = (id: string): DocJson => ({ type: "doc", content: [{ type: "anh", attrs: { id, w: 10, h: 10 } }] } as unknown as DocJson);

describe("roundsOfBook mang nguoi viet va ten luot", () => {
  it("authorId va ten theo tung luot", async () => {
    const { l1, l2, seat1, seat2 } = await haiLuot();
    expect([l1.authorId, l1.ten, l2.authorId, l2.ten]).toEqual([seat1.id, "Mưa phùn đầu ngõ", seat2.id, "Bánh mì"]);
  });
});

describe("sua luot theo nguoi viet", () => {
  it("chi sua duoc luot cua chinh minh; ghi sua-trang voi nguoi sua", async () => {
    const s = await haiLuot();
    const base = (r: typeof s.l1) => r.editedAt ?? r.publishedAt;
    expect(await editRound(s.db, s.seat2.id, s.sach, s.l1.id, [to("Linh viết thêm")], base(s.l1), T)).toBe("not-found");
    expect(await editRound(s.db, s.seat2.id, s.sach, s.l2.id, [to("Mạnh viết thêm")], base(s.l2), T)).toEqual({ status: "saved", first: 2 });
    expect(await s.db.select({ actorId: activity.actorId }).from(activity).where(eq(activity.kind, "sua-trang"))).toEqual([{ actorId: s.seat2.id }]);
  });

  it("readRoundForEdit, roundOfPosition, ownRoundExists chi thay luot cua chinh minh", async () => {
    const s = await haiLuot();
    expect(await readRoundForEdit(s.db, s.seat2.id, s.sach, 1)).toBeNull();
    expect(await readRoundForEdit(s.db, s.seat2.id, s.sach, 2)).toMatchObject({ ordinal: 2, ten: "Bánh mì", vietCung: true });
    expect(await readRoundForEdit(s.db, s.seat1.id, s.sach, 1)).toMatchObject({ ordinal: 1, ten: "Mưa phùn đầu ngõ", vietCung: true });
    expect(await roundOfPosition(s.db, s.seat2.id, s.sach, 1)).toBeNull();
    expect(await roundOfPosition(s.db, s.seat2.id, s.sach, 2)).toEqual({ ordinal: 2, sheet: 1 });
    expect(await ownRoundExists(s.db, s.seat2.id, s.sach, 1)).toBe(false);
    expect(await ownRoundExists(s.db, s.seat2.id, s.sach, 2)).toBe(true);
    expect(await ownRoundExists(s.db, s.seat1.id, s.sach, 2)).toBe(false);
    expect(await ownRoundExists(s.db, s.seat1.id, s.sach, 3)).toBe(false);
  });

  it("sach mot nguoi viet: chu sua moi luot nhu cu, readRoundForEdit bao vietCung sai", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một");
    expect(await readRoundForEdit(db, seat1.id, chung, 1)).toMatchObject({ ten: null, vietCung: false });
    expect(await readRoundForEdit(db, seat2.id, chung, 1)).toBeNull();
    expect(await ownRoundExists(db, seat1.id, chung, 1)).toBe(true);
  });
});

describe("renameRound", () => {
  it("doi ten luot cua minh: gom khoang trang, ghi doi-ten-luot; trung ten cu: unchanged", async () => {
    const s = await haiLuot();
    expect(await renameRound(s.db, s.seat2.id, s.sach, s.l2.id, "  Bánh mì   chợ Hàng Da ", T)).toBe("saved");
    expect(await s.db.select({ ten: rounds.ten }).from(rounds).where(eq(rounds.id, s.l2.id))).toEqual([{ ten: "Bánh mì chợ Hàng Da" }]);
    expect(await renameRound(s.db, s.seat2.id, s.sach, s.l2.id, "Bánh mì chợ Hàng Da", sau(1))).toBe("unchanged");
    expect(await s.db.select({ actorId: activity.actorId, roundId: activity.roundId, detail: activity.detail, shared: activity.shared })
      .from(activity).where(eq(activity.kind, "doi-ten-luot"))).toEqual([
      { actorId: s.seat2.id, roundId: s.l2.id, detail: { truoc: "Bánh mì", sau: "Bánh mì chợ Hàng Da" }, shared: true },
    ]);
  });

  it("doi nhieu lan lien nhau gop mot dong giu ten cua lan dau; doi ve nhu cu thi dong bien mat", async () => {
    const s = await haiLuot();
    await renameRound(s.db, s.seat1.id, s.sach, s.l1.id, "Mưa", T);
    await renameRound(s.db, s.seat1.id, s.sach, s.l1.id, "Mưa bay", sau(2));
    expect(await s.db.select({ detail: activity.detail, at: activity.at }).from(activity).where(eq(activity.kind, "doi-ten-luot")))
      .toEqual([{ detail: { truoc: "Mưa phùn đầu ngõ", sau: "Mưa bay" }, at: sau(2) }]);
    await renameRound(s.db, s.seat1.id, s.sach, s.l1.id, "Mưa phùn đầu ngõ", sau(3));
    expect(await s.db.select().from(activity).where(eq(activity.kind, "doi-ten-luot"))).toEqual([]);
  });

  it("luot cua nguoi kia, luot la, sach mot nguoi viet: not-found; ten hong: invalid; khong ghi gi", async () => {
    const s = await haiLuot();
    expect(await renameRound(s.db, s.seat2.id, s.sach, s.l1.id, "Cướp tên", T)).toBe("not-found");
    expect(await renameRound(s.db, s.seat2.id, s.sach, randomUUID(), "Tên", T)).toBe("not-found");
    expect(await renameRound(s.db, s.seat2.id, s.sach, s.l2.id, "   ", T)).toBe("invalid");
    expect(await renameRound(s.db, s.seat2.id, s.sach, s.l2.id, "ệ".repeat(61), T)).toBe("invalid");
    const c = await haiCuon();
    await dang(c.db, c.seat1.id, c.chung, "một");
    const [r] = await roundsOfBook(c.db, c.chung);
    expect(await renameRound(c.db, c.seat1.id, c.chung, r.id, "Tên", T)).toBe("not-found");
    expect(await c.db.select().from(activity).where(eq(activity.kind, "doi-ten-luot"))).toEqual([]);
  });
});

describe("o bia, o nhac, doi chu de: ca hai nguoi viet", () => {
  it("nguoi kia dat o bia va o nhac cua sach viet cung; dong Hoat dong la cua nguoi kia", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat2.id, s.sach, s.l1.id, { cover: "cau-go", coverMediaId: null }, T)).toBe("saved");
    expect(await setTrackEntry(s.db, s.seat2.id, s.sach, s.l2.id, { youtubeId: "dQw4w9WgXcQ" }, T)).toBe("saved");
    const dong = await s.db.select({ kind: activity.kind, actorId: activity.actorId }).from(activity)
      .where(and(eq(activity.bookId, s.sach), eq(activity.actorId, s.seat2.id)));
    expect(dong.map((d) => d.kind).sort()).toEqual(["dang-trang", "doi-bia", "doi-nhac"]);
  });

  it("nguoi kia khong dat o duoc tren sach mot nguoi viet", async () => {
    const { db, seat2, chung } = await haiCuon();
    expect(await setCoverEntry(db, seat2.id, chung, null, { cover: "cau-go", coverMediaId: null }, T)).toBe("not-found");
    expect(await setTrackEntry(db, seat2.id, chung, null, { youtubeId: "dQw4w9WgXcQ" }, T)).toBe("not-found");
  });

  it("anh bia da thuoc cuon dung chung; anh cho gan cua nguoi khac thi khong; kho anh cho ca hai", async () => {
    const s = await haiLuot();
    const cuaLinh = randomUUID();
    await recordUpload(s.db, { id: cuaLinh, ownerId: s.seat1.id, bookId: s.sach, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 });
    expect(await setCoverEntry(s.db, s.seat2.id, s.sach, s.l2.id, { cover: "nui-xa", coverMediaId: cuaLinh }, T)).toBe("saved");
    const choGan = randomUUID();
    await recordUpload(s.db, { id: choGan, ownerId: s.seat1.id, bookId: null, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 });
    expect(await setCoverEntry(s.db, s.seat2.id, s.sach, s.l1.id, { cover: "nui-xa", coverMediaId: choGan }, T)).toBe("invalid-cover");
    expect((await khoBia(s.db, s.seat2.id, s.sach)).map((p) => p.id)).toEqual([cuaLinh]);
    expect((await khoBia(s.db, s.seat1.id, s.sach)).map((p) => p.id)).toEqual([cuaLinh]);
    expect(await s.db.select({ m: bookCovers.coverMediaId }).from(bookCovers).where(eq(bookCovers.roundId, s.l2.id))).toEqual([{ m: cuaLinh }]);
  });

  it("updateBook: nguoi kia doi chu de sach viet cung; che do luon giu chia se; sach mot nguoi viet thi not-found", async () => {
    const s = await haiLuot();
    expect(await updateBook(s.db, s.seat2.id, s.sach, { title: "Bữa sáng hai đứa", mode: "rieng-tu" }, T)).toBe("saved");
    expect(await s.db.select({ title: books.title, mode: books.mode }).from(books).where(eq(books.id, s.sach)))
      .toEqual([{ title: "Bữa sáng hai đứa", mode: "chia-se" }]);
    expect(await s.db.select({ actorId: activity.actorId }).from(activity).where(eq(activity.kind, "doi-ten-sach"))).toEqual([{ actorId: s.seat2.id }]);
    const c = await haiCuon();
    expect(await updateBook(c.db, c.seat2.id, c.chung, { title: "Cướp", mode: "chia-se" }, T)).toBe("not-found");
  });
});

describe("media trong sach viet cung", () => {
  it("nguoi kia tai anh vao sach viet cung duoc, vao sach mot nguoi viet cua chu thi khong", async () => {
    const s = await vietCung();
    const c = await haiCuonTrong(s);
    expect(await recordUpload(s.db, { id: randomUUID(), ownerId: s.seat2.id, bookId: s.sach, kind: "anh", mime: "image/webp", bytes: 10, width: 10, height: 10 })).toBe(true);
    expect(await recordUpload(s.db, { id: randomUUID(), ownerId: s.seat2.id, bookId: c, kind: "anh", mime: "image/webp", bytes: 10, width: 10, height: 10 })).toBe(false);
  });

  it("anh chi nam trong nhap: chi nguoi tai len xem duoc; dang roi thi ca hai", async () => {
    const s = await vietCung();
    const id = randomUUID();
    await recordUpload(s.db, { id, ownerId: s.seat2.id, bookId: s.sach, kind: "anh", mime: "image/webp", bytes: 10, width: 10, height: 10 });
    await saveDraft(s.db, s.seat2.id, s.sach, anh(id), 1);
    expect((await canViewMedia(s.db, s.seat2.id, id, T))?.id).toBe(id);
    expect(await canViewMedia(s.db, s.seat1.id, id, T)).toBeNull();
    expect(await publishDraft(s.db, s.seat2.id, s.sach, [anh(id)], null, T, "Ảnh")).toEqual({ firstPosition: 1, count: 1 });
    expect((await canViewMedia(s.db, s.seat1.id, id, T))?.id).toBe(id);
  });
});

describe("hoi dap trong sach viet cung", () => {
  it("khong nhan loi hoi dap moi; loi hoi dap cu truoc khi viet cung van con", async () => {
    const c = await haiCuon();
    await dang(c.db, c.seat1.id, c.chung, "một");
    const [r] = await roundsOfBook(c.db, c.chung);
    expect(await submitRoundReply(c.db, c.seat2.id, r.id, "Hay quá", T)).toBe("sent");
    await c.db.update(books).set({ vietCungTu: T }).where(eq(books.id, c.chung));
    await dangTen(c.db, c.seat1.id, c.chung, "Lượt hai", "hai");
    const luot = await roundsOfBook(c.db, c.chung);
    expect(await submitRoundReply(c.db, c.seat2.id, luot[1].id, "Nữa", sau(1))).toBe("not-found");
    expect(await c.db.select({ body: roundReplies.body }).from(roundReplies)).toEqual([{ body: "Hay quá" }]);
  });
});

/** Mot cuon chia se mot nguoi viet cua seat1 trong cung database cua s. */
function haiCuonTrong(s: Awaited<ReturnType<typeof vietCung>>): Promise<string> {
  return createBook(s.db, s.seat1.id, { title: "Chạy bộ", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
}

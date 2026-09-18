import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { drafts, pages, seals } from "@/server/db/schema";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import { isLockedFor, sealAt, sealsOfBook } from "@/server/seal/seals";
import type { DocJson } from "@/lib/doc/types";
import { dang, haiCuon, to } from "../helpers/library";
import { CAU_DO, dangNiemPhong, henGio, TRAO_DOI } from "../helpers/seal";

const TRONG: DocJson = { type: "doc", content: [{ type: "paragraph" }] };

describe("publishDraft kem niem phong", () => {
  it("niem phong phu dung cac to cua lan dang, dong he lo lay tu to dau", async () => {
    const { db, seat1, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Tờ một");
    const r = await dangNiemPhong(db, seat1.id, chung, CAU_DO, "Em tới sớm hơn giờ hẹn.", "Tờ ba");
    expect(r).toEqual({ firstPosition: 2, count: 2 });
    const [s] = await sealsOfBook(db, chung);
    expect(s).toMatchObject({
      firstPosition: 2, lastPosition: 3, kind: "cau-do", question: "Mình gặp nhau ở đâu?",
      answers: ["ben xe mien dong"], teaser: "Em tới sớm hơn giờ hẹn.", openedAt: null,
    });
  });

  it("hai lan dang niem phong noi tiep nhau khong chong len nhau", async () => {
    const { db, seat1, chung } = await haiCuon();
    await dangNiemPhong(db, seat1.id, chung, TRAO_DOI, "Một", "Hai");
    await dangNiemPhong(db, seat1.id, chung, henGio(new Date("2030-01-01T00:00:00.000Z")), "Ba");
    const list = await sealsOfBook(db, chung);
    expect(list.map((s) => [s.kind, s.firstPosition, s.lastPosition])).toEqual([["trao-doi", 1, 2], ["hen-gio", 3, 3]]);
  });

  it("dang khong kem niem phong thi khong tao niem phong nao", async () => {
    const { db, seat1, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Một");
    expect(await db.select().from(seals)).toHaveLength(0);
  });

  it("to trong o cuoi bi bo thi niem phong chi phu cac to con lai", async () => {
    const { db, seat1, chung } = await haiCuon();
    const r = await publishDraft(db, seat1.id, chung, [to("Một"), to("Hai"), TRONG], TRAO_DOI);
    expect(r).toEqual({ firstPosition: 1, count: 2 });
    expect((await sealsOfBook(db, chung))[0].lastPosition).toBe(2);
  });

  it("cau do tren sach rieng tu bi tu choi ca lan dang: khong to nao, khong niem phong nao, ban nhap con nguyen", async () => {
    const { db, seat1, rieng } = await haiCuon();
    await saveDraft(db, seat1.id, rieng, to("Bí mật"), 1);
    expect(await publishDraft(db, seat1.id, rieng, [to("Bí mật")], CAU_DO)).toBeNull();
    expect(await publishDraft(db, seat1.id, rieng, [to("Bí mật")], TRAO_DOI)).toBeNull();
    expect(await db.select().from(pages).where(eq(pages.bookId, rieng))).toHaveLength(0);
    expect(await db.select().from(seals)).toHaveLength(0);
    expect(await db.select().from(drafts).where(eq(drafts.bookId, rieng))).toHaveLength(1);
  });

  it("hen gio tren sach rieng tu thi duoc", async () => {
    const { db, seat1, rieng } = await haiCuon();
    await dangNiemPhong(db, seat1.id, rieng, henGio(new Date("2030-01-01T00:00:00.000Z")), "Hộp thời gian");
    expect(await sealsOfBook(db, rieng)).toHaveLength(1);
  });
});

describe("isLockedFor", () => {
  const NOW = new Date("2026-09-13T08:00:00.000Z");
  const truoc = new Date(NOW.getTime() - 1);
  const sau = new Date(NOW.getTime() + 1);

  it("hen gio khoa ca chu sach lan nguoi kia cho toi dung gio mo", () => {
    for (const chu of [true, false]) {
      expect(isLockedFor({ kind: "hen-gio", opensAt: sau, openedAt: null }, chu, NOW)).toBe(true);
      expect(isLockedFor({ kind: "hen-gio", opensAt: NOW, openedAt: null }, chu, NOW)).toBe(false);
      expect(isLockedFor({ kind: "hen-gio", opensAt: truoc, openedAt: null }, chu, NOW)).toBe(false);
    }
  });

  it("cau do va trao doi khong bao gio khoa chu sach, khoa nguoi kia cho toi khi mo", () => {
    for (const kind of ["cau-do", "trao-doi"] as const) {
      expect(isLockedFor({ kind, opensAt: null, openedAt: null }, true, NOW)).toBe(false);
      expect(isLockedFor({ kind, opensAt: null, openedAt: null }, false, NOW)).toBe(true);
      expect(isLockedFor({ kind, opensAt: null, openedAt: truoc }, false, NOW)).toBe(false);
    }
  });
});

describe("sealAt", () => {
  const list = [{ firstPosition: 2, lastPosition: 3 }, { firstPosition: 5, lastPosition: 5 }];

  it("tim dung niem phong phu mot vi tri, ke ca hai dau khoang", () => {
    expect(sealAt(list, 2)).toBe(list[0]);
    expect(sealAt(list, 3)).toBe(list[0]);
    expect(sealAt(list, 5)).toBe(list[1]);
  });

  it("vi tri khong thuoc niem phong nao thi khong co", () => {
    expect(sealAt(list, 1)).toBeUndefined();
    expect(sealAt(list, 4)).toBeUndefined();
  });
});

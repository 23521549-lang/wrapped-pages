import { describe, it, expect } from "vitest";
import { asc, eq } from "drizzle-orm";
import { activity } from "@/server/db/schema";
import { GOP_DOC_MS, GOP_DOI_MS } from "@/server/feed/record";
import { createBook, updateBook } from "@/server/library/books";
import { editRound, readRoundForEdit } from "@/server/library/edit-round";
import { markRead } from "@/server/library/pages";
import { setCoverEntry, setTrackEntry } from "@/server/library/timeline";
import { setMood, withdrawMood } from "@/server/mood/moods";
import type { FeedKind } from "@/lib/feed/types";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";

/*
 * Bay loai su kien cua dot nam duoc ghi dung cho, trong dung giao dich cua hanh dong. Bon loai doi (ten, bia, nhac) va
 * sua trang gop trong GOP_DOI_MS, da doc gop trong GOP_DOC_MS: dong gop giu gia tri truoc cua lan dau, lay gia tri sau
 * cua lan cuoi; doi roi doi lai nhu cu thi dong bi xoa.
 */

const T = new Date("2026-09-20T08:00:00.000Z");
const sau = (ms: number) => new Date(T.getTime() + ms);
const PHUT = 60_000;
const VIDEO = "dQw4w9WgXcQ";

async function dong(db: TestDb, kind: FeedKind) {
  return db.select().from(activity).where(eq(activity.kind, kind)).orderBy(asc(activity.at));
}

/** Hai cho ngoi va hai cuon cua seat1, bo cac dong tao-sach cua buoc dung. */
async function bo() {
  const s = await haiCuon();
  await s.db.delete(activity);
  return s;
}

describe("ghi su kien dot nam", () => {
  it("tao sach: mot dong tao-sach khong luot, chia se theo che do cuon", async () => {
    const s = await bo();
    const chung = await createBook(s.db, s.seat1.id, { title: "Mới", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null }, T);
    const rieng = await createBook(s.db, s.seat1.id, { title: "Riêng", mode: "rieng-tu", cover: "nui-xa", youtubeId: null, coverMediaId: null }, T);
    expect((await dong(s.db, "tao-sach")).map((r) => [r.bookId, r.roundId, r.shared, r.at])).toEqual(
      expect.arrayContaining([[chung, null, true, T], [rieng, null, false, T]]),
    );
  });

  it("tha tam trang: moi lan tha mot dong gan dung tam trang; thu lai khong ghi gi", async () => {
    const s = await bo();
    const m = await setMood(s.db, s.seat2.id, "nang-am", "Vui ghê", T);
    if (!m) throw new Error("khong tha duoc");
    expect((await dong(s.db, "tha-tam-trang")).map((r) => [r.actorId, r.moodId, r.at, r.shared])).toEqual([[s.seat2.id, m.id, m.setAt, true]]);
    await withdrawMood(s.db, s.seat2.id, sau(PHUT));
    expect(await dong(s.db, "tha-tam-trang")).toHaveLength(1);
  });

  it("doi ten: chi khi ten doi; gop trong cua so; doi lai nhu cu thi xoa; qua cua so thi dong moi", async () => {
    const s = await bo();
    const doi = (title: string, luc: Date) => updateBook(s.db, s.seat1.id, s.chung, { title, mode: "chia-se" }, luc);
    await doi("Chuyện chưa kể", T);
    expect(await dong(s.db, "doi-ten-sach")).toEqual([]);
    await doi("Tên hai", T);
    await doi("Tên ba", sau(PHUT));
    expect((await dong(s.db, "doi-ten-sach")).map((r) => [r.detail, r.at, r.roundId])).toEqual([
      [{ truoc: "Chuyện chưa kể", sau: "Tên ba" }, sau(PHUT), null],
    ]);
    await doi("Chuyện chưa kể", sau(2 * PHUT));
    expect(await dong(s.db, "doi-ten-sach")).toEqual([]);
    await doi("Tên bốn", sau(3 * PHUT + GOP_DOI_MS));
    expect((await dong(s.db, "doi-ten-sach")).map((r) => r.detail)).toEqual([{ truoc: "Chuyện chưa kể", sau: "Tên bốn" }]);
  });

  it("doi bia o mo dau: gia tri truoc va sau; dat lai y nguyen khong ghi; doi lai bia cu thi xoa", async () => {
    const s = await bo();
    const dat = (cover: "hoa-dao" | "nui-xa", luc: Date) =>
      setCoverEntry(s.db, s.seat1.id, s.chung, null, { cover, coverMediaId: null }, luc);
    expect(await dat("hoa-dao", T)).toBe("saved");
    expect((await dong(s.db, "doi-bia")).map((r) => [r.roundId, r.detail, r.shared])).toEqual([
      [null, { truoc: { cover: "nui-xa", anhId: null }, sau: { cover: "hoa-dao", anhId: null } }, true],
    ]);
    await dat("hoa-dao", sau(PHUT));
    expect((await dong(s.db, "doi-bia")).map((r) => r.at)).toEqual([T]);
    await dat("nui-xa", sau(2 * PHUT));
    expect(await dong(s.db, "doi-bia")).toEqual([]);
  });

  it("doi bia mot luot: dien roi don trong cua so la xoa; don o bia cuoi cung bi tu choi thi khong ghi", async () => {
    const s = await bo();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const r = await readRoundForEdit(s.db, s.seat1.id, s.chung, 1);
    if (!r) throw new Error("khong thay luot");
    await setCoverEntry(s.db, s.seat1.id, s.chung, r.id, { cover: "cau-go", coverMediaId: null }, T);
    expect((await dong(s.db, "doi-bia")).map((x) => [x.roundId, x.detail])).toEqual([
      [r.id, { truoc: null, sau: { cover: "cau-go", anhId: null } }],
    ]);
    await setCoverEntry(s.db, s.seat1.id, s.chung, r.id, null, sau(PHUT));
    expect(await dong(s.db, "doi-bia")).toEqual([]);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, null, null, sau(2 * PHUT))).toBe("last-cover");
    expect(await dong(s.db, "doi-bia")).toEqual([]);
  });

  it("doi nhac: dat bai, roi tat nhac trong cua so thi gop; cuon rieng tu thi khong chia se", async () => {
    const s = await bo();
    await setTrackEntry(s.db, s.seat1.id, s.chung, null, { youtubeId: VIDEO }, T);
    await setTrackEntry(s.db, s.seat1.id, s.chung, null, { youtubeId: null }, sau(PHUT));
    expect((await dong(s.db, "doi-nhac")).map((r) => [r.detail, r.at])).toEqual([
      [{ truoc: null, sau: { youtubeId: null } }, sau(PHUT)],
    ]);
    await setTrackEntry(s.db, s.seat1.id, s.rieng, null, { youtubeId: VIDEO }, T);
    expect((await dong(s.db, "doi-nhac")).find((r) => r.bookId === s.rieng)?.shared).toBe(false);
  });

  it("sua trang: chi khi luu thay doi; gop trong cua so; qua cua so thi dong moi", async () => {
    const s = await bo();
    await dang(s.db, s.seat1.id, s.chung, "Một chiều mưa");
    const sua = async (chu: string, luc: Date) => {
      const r = await readRoundForEdit(s.db, s.seat1.id, s.chung, 1);
      if (!r) throw new Error("khong thay luot");
      return editRound(s.db, s.seat1.id, s.chung, r.id, [to(chu)], new Date(r.version), luc);
    };
    expect(await sua("Một chiều mưa", T)).toMatchObject({ status: "unchanged" });
    expect(await dong(s.db, "sua-trang")).toEqual([]);
    await sua("Một chiều mưa rơi", T);
    await sua("Một chiều mưa rơi nhẹ", sau(PHUT));
    expect((await dong(s.db, "sua-trang")).map((r) => [r.at, r.detail])).toEqual([[sau(PHUT), null]]);
    await sua("Một chiều mưa rơi nhẹ thôi", sau(2 * PHUT + GOP_DOI_MS));
    expect(await dong(s.db, "sua-trang")).toHaveLength(2);
  });

  it("da doc: chi khi co trang moi ghi lan dau; gop trong cua so, den la trang xa nhat; chu sach khong ghi", async () => {
    const s = await bo();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai", "Ba");
    const luot = (await readRoundForEdit(s.db, s.seat1.id, s.chung, 1))?.id;
    expect(await markRead(s.db, s.seat2.id, s.chung, [1, 2], T)).toEqual([1, 2]);
    expect((await dong(s.db, "da-doc")).map((r) => [r.actorId, r.detail, r.roundId, r.at])).toEqual([[s.seat2.id, { den: 2 }, luot, T]]);
    await markRead(s.db, s.seat2.id, s.chung, [1, 2], sau(PHUT));
    expect((await dong(s.db, "da-doc")).map((r) => r.at)).toEqual([T]);
    await markRead(s.db, s.seat2.id, s.chung, [3], sau(5 * PHUT));
    expect((await dong(s.db, "da-doc")).map((r) => [r.detail, r.at])).toEqual([[{ den: 3 }, sau(5 * PHUT)]]);
    await markRead(s.db, s.seat2.id, s.chung, [3], sau(5 * PHUT + GOP_DOC_MS + 1));
    expect(await dong(s.db, "da-doc")).toHaveLength(1);
    await markRead(s.db, s.seat1.id, s.chung, [1], T);
    expect(await dong(s.db, "da-doc")).toHaveLength(1);
  });
});

import { describe, it, expect } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accounts, activity, books, moods, seals } from "@/server/db/schema";
import { recordActivity, type ActivityEvent } from "@/server/feed/record";
import { FEED_KINDS, LOAI_NIEM_PHONG, type FeedKind } from "@/lib/feed/types";
import { viPham } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

const NOW = new Date("2026-09-15T08:00:00.000Z");

type ActivityInsert = typeof activity.$inferInsert;

async function coNiemPhong() {
  const s = await haiCuon();
  const roundId = await luotChu(s.db, s.chung, 2, 3);
  const [seal] = await s.db
    .insert(seals)
    .values({ bookId: s.chung, roundId, kind: "cau-do", question: "Ở đâu?", answers: ["ben xe"], teaser: "" })
    .returning({ id: seals.id });
  const luotRieng = await luotChu(s.db, s.rieng, 1);
  const [mood] = await s.db
    .insert(moods)
    .values({ accountId: s.seat2.id, weather: "nang-am", note: "Vui ghê", setAt: NOW, endsAt: new Date(NOW.getTime() + 3_600_000) })
    .returning({ id: moods.id });
  // Cac dong tao-sach do haiCuon ghi ra khong thuoc bai nay.
  await s.db.delete(activity);
  return { ...s, sealId: seal.id, roundId, luotRieng, moodId: mood.id };
}

type CoNiemPhong = Awaited<ReturnType<typeof coNiemPhong>>;

/** Moi loai mot su kien dung hinh; kieu buoc phai du ca muoi lam loai. */
function moiLoai(s: CoNiemPhong): { [K in FeedKind]: ActivityEvent & { kind: K } } {
  const cuaChu = { actorId: s.seat1.id, at: NOW, bookId: s.chung, roundId: s.roundId, mode: "chia-se" } as const;
  const cuaNguoiKia = { ...cuaChu, actorId: s.seat2.id, sealId: s.sealId };
  const cuaSach = { actorId: s.seat1.id, at: NOW, bookId: s.chung, mode: "chia-se" } as const;
  return {
    "dang-trang": { ...cuaChu, kind: "dang-trang", sealId: null },
    "moi-trao-doi": { ...cuaChu, kind: "moi-trao-doi", sealId: s.sealId },
    "mo-hen-gio": { ...cuaChu, kind: "mo-hen-gio", sealId: s.sealId },
    "mo-trang": { ...cuaNguoiKia, kind: "mo-trang" },
    "thu-sai": { ...cuaNguoiKia, kind: "thu-sai" },
    "tang-khoa": { ...cuaChu, kind: "tang-khoa", sealId: s.sealId },
    "doi-mat-khau": { kind: "doi-mat-khau", actorId: s.seat2.id, subjectId: s.seat1.id, at: NOW },
    "hoi-dap": { ...cuaChu, actorId: s.seat2.id, kind: "hoi-dap", sealId: null },
    "tha-tam-trang": { kind: "tha-tam-trang", actorId: s.seat2.id, at: NOW, moodId: s.moodId },
    "tao-sach": { ...cuaSach, kind: "tao-sach" },
    "doi-ten-sach": { ...cuaSach, kind: "doi-ten-sach", detail: { truoc: "Cũ", sau: "Mới" } },
    "doi-bia": { ...cuaSach, kind: "doi-bia", roundId: null, detail: { truoc: { cover: "nui-xa", anhId: null }, sau: { cover: "hoa-dao", anhId: null } } },
    "doi-nhac": { ...cuaSach, kind: "doi-nhac", roundId: s.roundId, detail: { truoc: null, sau: { youtubeId: null } } },
    "sua-trang": { ...cuaChu, kind: "sua-trang" },
    "da-doc": { ...cuaChu, actorId: s.seat2.id, kind: "da-doc", detail: { den: 3 } },
  };
}

/** Hang dung hinh ghi thang vao bang, de moi ca chi lam sai dung mot luat. */
const hangSach = (s: CoNiemPhong): ActivityInsert => ({
  kind: "thu-sai", actorId: s.seat2.id, bookId: s.chung, sealId: s.sealId, roundId: s.roundId, shared: true, at: NOW,
});
const hangMatKhau = (s: CoNiemPhong): ActivityInsert => ({
  kind: "doi-mat-khau", actorId: s.seat2.id, subjectId: s.seat1.id, shared: false, at: NOW,
});
const hangTamTrang = (s: CoNiemPhong): ActivityInsert => ({
  kind: "tha-tam-trang", actorId: s.seat2.id, moodId: s.moodId, shared: true, at: NOW,
});
const hangMoi = (s: CoNiemPhong, kind: FeedKind, them: Partial<ActivityInsert> = {}): ActivityInsert => ({
  kind, actorId: s.seat1.id, bookId: s.chung, roundId: s.roundId, shared: true, at: NOW, ...them,
});

describe("bang activity", () => {
  it("danh sach loai trong CHECK activity_kind khop dung FEED_KINDS, ca thu tu", async () => {
    const { db } = await haiCuon();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'activity_kind'`);
    const def = (res.rows as { def: string }[])[0].def;
    expect(def.match(/'[a-z-]+'/g)).toEqual(FEED_KINDS.map((k) => `'${k}'`));
  });

  it("cot moi la mood_id va detail (jsonb); cot text duy nhat van la kind", () => {
    const cols = getTableConfig(activity).columns;
    expect(cols.map((c) => c.name).sort()).toEqual(
      ["actor_id", "at", "book_id", "detail", "id", "kind", "mood_id", "round_id", "seal_id", "shared", "subject_id"],
    );
    expect(cols.filter((c) => c.getSQLType() === "text").map((c) => c.name)).toEqual(["kind"]);
    expect(cols.find((c) => c.name === "detail")?.getSQLType()).toBe("jsonb");
  });

  it("recordActivity ghi duoc moi loai, shared theo che do cuon luc ghi, tam trang luon chia se", async () => {
    const s = await coNiemPhong();
    const events = moiLoai(s);
    for (const kind of FEED_KINDS) await recordActivity(s.db, events[kind]);
    await recordActivity(s.db, { ...events["dang-trang"], bookId: s.rieng, mode: "rieng-tu", roundId: s.luotRieng });
    const rows = await s.db.select().from(activity).orderBy(asc(activity.kind), asc(activity.shared));
    expect(rows.map((r) => [r.kind, r.shared])).toEqual([
      ["da-doc", true], ["dang-trang", false], ["dang-trang", true], ["doi-bia", true], ["doi-mat-khau", false],
      ["doi-nhac", true], ["doi-ten-sach", true], ["hoi-dap", true], ["mo-hen-gio", true], ["mo-trang", true],
      ["moi-trao-doi", true], ["sua-trang", true], ["tang-khoa", true], ["tao-sach", true], ["tha-tam-trang", true],
      ["thu-sai", true],
    ]);
    expect(rows.find((r) => r.kind === "tha-tam-trang")).toEqual({
      id: expect.any(String), kind: "tha-tam-trang", actorId: s.seat2.id, subjectId: null, bookId: null, sealId: null,
      roundId: null, moodId: s.moodId, detail: null, shared: true, at: NOW,
    });
    expect(rows.find((r) => r.kind === "doi-bia")).toEqual({
      id: expect.any(String), kind: "doi-bia", actorId: s.seat1.id, subjectId: null, bookId: s.chung, sealId: null,
      roundId: null, moodId: null, shared: true, at: NOW,
      detail: { truoc: { cover: "nui-xa", anhId: null }, sau: { cover: "hoa-dao", anhId: null } },
    });
    expect(rows.find((r) => r.kind === "tao-sach")).toMatchObject({ roundId: null, detail: null, sealId: null });
    expect(rows.find((r) => r.kind === "da-doc")).toMatchObject({ roundId: s.roundId, detail: { den: 3 } });
  });

  /** Moi ca chi lam hang dung hinh sai dung mot luat. */
  type Sua = (s: CoNiemPhong) => Partial<ActivityInsert> | { kind: string };

  it.each<[string, Sua, string]>([
    ["loai la", () => ({ kind: "xoa-sach" }), "activity_kind"],
    ["gan sach ma thieu sach", () => ({ bookId: null }), "activity_sach"],
    ["gan sach ma co nguoi bi doi", (s) => ({ subjectId: s.seat1.id }), "activity_sach"],
    ["thieu luot", () => ({ roundId: null }), "activity_sach"],
    ["hoi-dap ma thieu luot", () => ({ kind: "hoi-dap", sealId: null, roundId: null }), "activity_sach"],
    ...LOAI_NIEM_PHONG.map((kind): [string, Sua, string] => [
      `${kind} ma thieu niem phong`, () => ({ kind, sealId: null }), "activity_niem_phong",
    ]),
  ])("tu choi su kien gan sach sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const s = await coNiemPhong();
    await viPham(s.db.insert(activity).values({ ...hangSach(s), ...sua(s) } as ActivityInsert), rangBuoc);
  });

  it.each<[string, Sua, string]>([
    ["thieu nguoi bi doi", () => ({ subjectId: null }), "activity_mat_khau"],
    ["tu doi mat khau cua minh", (s) => ({ subjectId: s.seat2.id }), "activity_mat_khau"],
    ["gan sach", (s) => ({ bookId: s.chung }), "activity_mat_khau"],
    ["gan niem phong", (s) => ({ sealId: s.sealId }), "activity_mat_khau"],
    ["gan luot", (s) => ({ roundId: s.roundId }), "activity_mat_khau"],
    ["danh dau chia se", () => ({ shared: true }), "activity_mat_khau"],
  ])("tu choi doi-mat-khau sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const s = await coNiemPhong();
    await viPham(s.db.insert(activity).values({ ...hangMatKhau(s), ...sua(s) } as ActivityInsert), rangBuoc);
  });

  it.each<[string, Sua, string]>([
    ["thieu tam trang", () => ({ moodId: null }), "activity_tam_trang"],
    ["gan sach", (s) => ({ bookId: s.chung }), "activity_tam_trang"],
    ["gan luot", (s) => ({ roundId: s.roundId }), "activity_tam_trang"],
    ["khong chia se", () => ({ shared: false }), "activity_tam_trang"],
    ["co chi tiet", () => ({ detail: { den: 1 } }), "activity_detail"],
  ])("tu choi tha-tam-trang sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const s = await coNiemPhong();
    await viPham(s.db.insert(activity).values({ ...hangTamTrang(s), ...sua(s) } as ActivityInsert), rangBuoc);
  });

  it.each<[string, (s: CoNiemPhong) => ActivityInsert, string]>([
    ["dang-trang gan tam trang", (s) => hangMoi(s, "dang-trang", { moodId: s.moodId }), "activity_tam_trang"],
    ["tao-sach gan luot", (s) => hangMoi(s, "tao-sach"), "activity_sach"],
    ["doi-ten-sach gan luot", (s) => hangMoi(s, "doi-ten-sach", { detail: { truoc: "a", sau: "b" } }), "activity_sach"],
    ["sua-trang thieu luot", (s) => hangMoi(s, "sua-trang", { roundId: null }), "activity_sach"],
    ["da-doc thieu luot", (s) => hangMoi(s, "da-doc", { roundId: null, detail: { den: 1 } }), "activity_sach"],
    ["tao-sach gan niem phong", (s) => hangMoi(s, "tao-sach", { roundId: null, sealId: s.sealId }), "activity_niem_phong"],
    ["sua-trang gan niem phong", (s) => hangMoi(s, "sua-trang", { sealId: s.sealId }), "activity_niem_phong"],
    ["da-doc thieu chi tiet", (s) => hangMoi(s, "da-doc"), "activity_detail"],
    ["doi-bia chi tiet la mang", (s) => hangMoi(s, "doi-bia", { detail: [1, 2] }), "activity_detail"],
    ["sua-trang co chi tiet", (s) => hangMoi(s, "sua-trang", { detail: { den: 2 } }), "activity_detail"],
    ["dang-trang co chi tiet", (s) => hangMoi(s, "dang-trang", { detail: { den: 2 } }), "activity_detail"],
  ])("tu choi loai moi sai hinh: %s", async (_ten, hang, rangBuoc) => {
    const s = await coNiemPhong();
    await viPham(s.db.insert(activity).values(hang(s)), rangBuoc);
  });

  it("doi-bia va doi-nhac duoc gan luot hay o mo dau; loai cu van duoc gan niem phong nhu truoc", async () => {
    const s = await coNiemPhong();
    const chiTiet = { truoc: null, sau: null };
    await s.db.insert(activity).values([
      hangMoi(s, "doi-bia", { roundId: null, detail: chiTiet }),
      hangMoi(s, "doi-bia", { detail: chiTiet }),
      hangMoi(s, "doi-nhac", { roundId: null, detail: chiTiet }),
      hangMoi(s, "hoi-dap", { sealId: s.sealId }),
      hangMoi(s, "dang-trang", { sealId: s.sealId }),
    ]);
    expect(await s.db.select({ n: sql<number>`count(*)::int` }).from(activity)).toEqual([{ n: 5 }]);
  });

  it("xoa sach, niem phong, tam trang hay tai khoan thi xoa theo su kien cua no", async () => {
    const s = await coNiemPhong();
    const events = moiLoai(s);
    for (const kind of FEED_KINDS) await recordActivity(s.db, events[kind]);
    await s.db.delete(seals).where(eq(seals.id, s.sealId));
    await s.db.delete(moods).where(eq(moods.id, s.moodId));
    expect((await s.db.select().from(activity)).map((r) => r.kind).sort()).toEqual([
      "da-doc", "dang-trang", "doi-bia", "doi-mat-khau", "doi-nhac", "doi-ten-sach", "hoi-dap", "sua-trang", "tao-sach",
    ]);
    await s.db.delete(books).where(eq(books.id, s.chung));
    expect((await s.db.select().from(activity)).map((r) => r.kind)).toEqual(["doi-mat-khau"]);
    await s.db.delete(accounts).where(eq(accounts.id, s.seat1.id));
    expect(await s.db.select().from(activity)).toEqual([]);
  });
});

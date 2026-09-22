import { describe, it, expect } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accounts, activity, books, seals } from "@/server/db/schema";
import { recordActivity, type ActivityEvent } from "@/server/feed/record";
import { FEED_KINDS, type FeedKind } from "@/lib/feed/types";
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
  return { ...s, sealId: seal.id, roundId, luotRieng };
}

type CoNiemPhong = Awaited<ReturnType<typeof coNiemPhong>>;

/** Moi loai mot su kien dung hinh; kieu buoc phai du ca bay loai. */
function moiLoai(s: CoNiemPhong): { [K in FeedKind]: ActivityEvent & { kind: K } } {
  const cuaChu = { actorId: s.seat1.id, at: NOW, bookId: s.chung, roundId: s.roundId, mode: "chia-se" } as const;
  const cuaNguoiKia = { ...cuaChu, actorId: s.seat2.id, sealId: s.sealId };
  return {
    "dang-trang": { ...cuaChu, kind: "dang-trang", sealId: null },
    "moi-trao-doi": { ...cuaChu, kind: "moi-trao-doi", sealId: s.sealId },
    "mo-hen-gio": { ...cuaChu, kind: "mo-hen-gio", sealId: s.sealId },
    "mo-trang": { ...cuaNguoiKia, kind: "mo-trang" },
    "thu-sai": { ...cuaNguoiKia, kind: "thu-sai" },
    "tang-khoa": { ...cuaChu, kind: "tang-khoa", sealId: s.sealId },
    "doi-mat-khau": { kind: "doi-mat-khau", actorId: s.seat2.id, subjectId: s.seat1.id, at: NOW },
  };
}

/** Nam loai gan mot niem phong: CHECK activity_niem_phong bat buoc seal_id cho tung loai. */
const LOAI_GAN_NIEM_PHONG = ["moi-trao-doi", "mo-hen-gio", "mo-trang", "thu-sai", "tang-khoa"] as const satisfies readonly FeedKind[];

/** Hang dung hinh ghi thang vao bang, de moi ca chi lam sai dung mot luat. */
const hangSach = (s: CoNiemPhong): ActivityInsert => ({
  kind: "thu-sai", actorId: s.seat2.id, bookId: s.chung, sealId: s.sealId, roundId: s.roundId, shared: true, at: NOW,
});
const hangMatKhau = (s: CoNiemPhong): ActivityInsert => ({
  kind: "doi-mat-khau", actorId: s.seat2.id, subjectId: s.seat1.id, shared: false, at: NOW,
});

describe("bang activity", () => {
  it("danh sach loai trong CHECK activity_kind khop dung FEED_KINDS, ca thu tu", async () => {
    const { db } = await haiCuon();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'activity_kind'`);
    const def = (res.rows as { def: string }[])[0].def;
    expect(def.match(/'[a-z-]+'/g)).toEqual(FEED_KINDS.map((k) => `'${k}'`));
  });

  it("khong co cot chu tu do: cot text duy nhat la kind", () => {
    const cols = getTableConfig(activity).columns;
    expect(cols.map((c) => c.name).sort()).toEqual(
      ["actor_id", "at", "book_id", "id", "kind", "round_id", "seal_id", "shared", "subject_id"],
    );
    expect(cols.filter((c) => c.getSQLType() === "text").map((c) => c.name)).toEqual(["kind"]);
  });

  it("recordActivity ghi duoc moi loai, shared theo che do cuon luc ghi, doi-mat-khau khong gan sach", async () => {
    const s = await coNiemPhong();
    const events = moiLoai(s);
    for (const kind of FEED_KINDS) await recordActivity(s.db, events[kind]);
    await recordActivity(s.db, { ...events["dang-trang"], bookId: s.rieng, mode: "rieng-tu", roundId: s.luotRieng });
    const rows = await s.db.select().from(activity).orderBy(asc(activity.kind), asc(activity.shared));
    expect(rows.map((r) => [r.kind, r.shared])).toEqual([
      ["dang-trang", false], ["dang-trang", true], ["doi-mat-khau", false], ["mo-hen-gio", true],
      ["mo-trang", true], ["moi-trao-doi", true], ["tang-khoa", true], ["thu-sai", true],
    ]);
    expect(rows.find((r) => r.kind === "doi-mat-khau")).toEqual({
      id: expect.any(String), kind: "doi-mat-khau", actorId: s.seat2.id, subjectId: s.seat1.id,
      bookId: null, sealId: null, roundId: null, shared: false, at: NOW,
    });
    expect(rows.find((r) => r.kind === "thu-sai")).toEqual({
      id: expect.any(String), kind: "thu-sai", actorId: s.seat2.id, subjectId: null,
      bookId: s.chung, sealId: s.sealId, roundId: s.roundId, shared: true, at: NOW,
    });
  });

  /** Moi ca chi lam hang dung hinh sai dung mot luat. */
  type Sua = (s: CoNiemPhong) => Partial<ActivityInsert> | { kind: string };

  it.each<[string, Sua, string]>([
    ["loai la", () => ({ kind: "xoa-sach" }), "activity_kind"],
    ["gan sach ma thieu sach", () => ({ bookId: null }), "activity_sach"],
    ["gan sach ma co nguoi bi doi", (s) => ({ subjectId: s.seat1.id }), "activity_sach"],
    ["thieu luot", () => ({ roundId: null }), "activity_sach"],
    ...LOAI_GAN_NIEM_PHONG.map((kind): [string, Sua, string] => [
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

  it("dang-trang khong can niem phong; xoa sach, niem phong hay tai khoan thi xoa theo su kien cua no", async () => {
    const s = await coNiemPhong();
    const events = moiLoai(s);
    for (const kind of FEED_KINDS) await recordActivity(s.db, events[kind]);
    await s.db.delete(seals).where(eq(seals.id, s.sealId));
    expect((await s.db.select().from(activity)).map((r) => r.kind).sort()).toEqual(["dang-trang", "doi-mat-khau"]);
    await s.db.delete(books).where(eq(books.id, s.chung));
    expect((await s.db.select().from(activity)).map((r) => r.kind)).toEqual(["doi-mat-khau"]);
    await s.db.delete(accounts).where(eq(accounts.id, s.seat1.id));
    expect(await s.db.select().from(activity)).toEqual([]);
  });
});

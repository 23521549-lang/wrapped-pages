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
    "gui-thu": { kind: "gui-thu", actorId: s.seat2.id, at: NOW, detail: { thang: "2026-08" } },
    "tha-cam-xuc": { kind: "tha-cam-xuc", actorId: s.seat2.id, at: NOW, detail: { cam: "yeu" } },
    "moi-viet": { ...cuaSach, kind: "moi-viet" },
    "xin-viet": { ...cuaSach, actorId: s.seat2.id, kind: "xin-viet" },
    "nhan-viet": { ...cuaSach, actorId: s.seat2.id, kind: "nhan-viet", detail: { tu: "moi-viet" } },
    "tu-choi": { ...cuaSach, actorId: s.seat2.id, kind: "tu-choi", detail: { viec: "xoa-sach" } },
    "de-nghi-xoa": { ...cuaSach, kind: "de-nghi-xoa" },
    "doi-ten-luot": { ...cuaChu, kind: "doi-ten-luot", detail: { truoc: null, sau: "Mưa phùn đầu ngõ" } },
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

  it("cot moi la mood_id, detail (jsonb) va an; cot text duy nhat van la kind", () => {
    const cols = getTableConfig(activity).columns;
    expect(cols.map((c) => c.name).sort()).toEqual(
      ["actor_id", "an", "at", "book_id", "detail", "id", "kind", "mood_id", "round_id", "seal_id", "shared", "subject_id"],
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
      ["da-doc", true], ["dang-trang", false], ["dang-trang", true], ["de-nghi-xoa", true], ["doi-bia", true],
      ["doi-mat-khau", false], ["doi-nhac", true], ["doi-ten-luot", true], ["doi-ten-sach", true], ["gui-thu", true],
      ["hoi-dap", true], ["mo-hen-gio", true], ["mo-trang", true], ["moi-trao-doi", true], ["moi-viet", true],
      ["nhan-viet", true], ["sua-trang", true], ["tang-khoa", true], ["tao-sach", true], ["tha-cam-xuc", true],
      ["tha-tam-trang", true], ["thu-sai", true], ["tu-choi", true], ["xin-viet", true],
    ]);
    expect(rows.find((r) => r.kind === "moi-viet")).toMatchObject({ roundId: null, detail: null, sealId: null, bookId: s.chung });
    expect(rows.find((r) => r.kind === "doi-ten-luot")).toMatchObject({ roundId: s.roundId, detail: { truoc: null, sau: "Mưa phùn đầu ngõ" } });
    expect(rows.find((r) => r.kind === "tha-tam-trang")).toEqual({
      id: expect.any(String), kind: "tha-tam-trang", actorId: s.seat2.id, subjectId: null, bookId: null, sealId: null,
      roundId: null, moodId: s.moodId, detail: null, shared: true, an: false, at: NOW,
    });
    expect(rows.find((r) => r.kind === "doi-bia")).toEqual({
      id: expect.any(String), kind: "doi-bia", actorId: s.seat1.id, subjectId: null, bookId: s.chung, sealId: null,
      roundId: null, moodId: null, shared: true, an: false, at: NOW,
      detail: { truoc: { cover: "nui-xa", anhId: null }, sau: { cover: "hoa-dao", anhId: null } },
    });
    expect(rows.find((r) => r.kind === "tao-sach")).toMatchObject({ roundId: null, detail: null, sealId: null });
    expect(rows.find((r) => r.kind === "da-doc")).toMatchObject({ roundId: s.roundId, detail: { den: 3 } });
    expect(rows.find((r) => r.kind === "gui-thu")).toEqual({
      id: expect.any(String), kind: "gui-thu", actorId: s.seat2.id, subjectId: null, bookId: null, sealId: null,
      roundId: null, moodId: null, detail: { thang: "2026-08" }, shared: true, an: false, at: NOW,
    });
    expect(rows.find((r) => r.kind === "tha-cam-xuc")).toEqual({
      id: expect.any(String), kind: "tha-cam-xuc", actorId: s.seat2.id, subjectId: null, bookId: null, sealId: null,
      roundId: null, moodId: null, detail: { cam: "yeu" }, shared: true, an: false, at: NOW,
    });
  });

  const hangThu = (s: CoNiemPhong): ActivityInsert => ({
    kind: "gui-thu", actorId: s.seat2.id, detail: { thang: "2026-08" }, shared: true, at: NOW,
  });

  it.each<[string, Sua, string]>([
    ["thieu chi tiet", () => ({ detail: null }), "activity_detail"],
    ["gan sach", (s) => ({ bookId: s.chung }), "activity_thu"],
    ["gan luot", (s) => ({ roundId: s.roundId }), "activity_thu"],
    ["gan nguoi bi doi", (s) => ({ subjectId: s.seat1.id }), "activity_thu"],
    ["gan niem phong", (s) => ({ sealId: s.sealId }), "activity_niem_phong"],
    ["gan tam trang", (s) => ({ moodId: s.moodId }), "activity_tam_trang"],
    ["khong chia se", () => ({ shared: false }), "activity_thu"],
  ])("tu choi gui-thu sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const s = await coNiemPhong();
    await viPham(s.db.insert(activity).values({ ...hangThu(s), ...sua(s) } as ActivityInsert), rangBuoc);
  });

  const hangCamXuc = (s: CoNiemPhong): ActivityInsert => ({
    kind: "tha-cam-xuc", actorId: s.seat2.id, detail: { cam: "nho" }, shared: true, at: NOW,
  });

  it.each<[string, Sua, string]>([
    ["thieu chi tiet", () => ({ detail: null }), "activity_detail"],
    ["gan sach", (s) => ({ bookId: s.chung }), "activity_cam_xuc"],
    ["gan luot", (s) => ({ roundId: s.roundId }), "activity_cam_xuc"],
    ["gan nguoi bi doi", (s) => ({ subjectId: s.seat1.id }), "activity_cam_xuc"],
    // Postgres kiem CHECK theo ten: activity_cam_xuc (cung chan niem phong, tam trang) dung truoc hai luat kia.
    ["gan niem phong", (s) => ({ sealId: s.sealId }), "activity_cam_xuc"],
    ["gan tam trang", (s) => ({ moodId: s.moodId }), "activity_cam_xuc"],
    ["khong chia se", () => ({ shared: false }), "activity_cam_xuc"],
  ])("tu choi tha-cam-xuc sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const s = await coNiemPhong();
    await viPham(s.db.insert(activity).values({ ...hangCamXuc(s), ...sua(s) } as ActivityInsert), rangBuoc);
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
    ["moi-viet gan luot", (s) => hangMoi(s, "moi-viet"), "activity_sach"],
    ["de-nghi-xoa thieu sach", (s) => hangMoi(s, "de-nghi-xoa", { roundId: null, bookId: null }), "activity_sach"],
    ["nhan-viet thieu chi tiet", (s) => hangMoi(s, "nhan-viet", { roundId: null }), "activity_detail"],
    ["tu-choi gan niem phong", (s) => hangMoi(s, "tu-choi", { roundId: null, sealId: s.sealId, detail: { viec: "moi-viet" } }), "activity_niem_phong"],
    ["doi-ten-luot thieu luot", (s) => hangMoi(s, "doi-ten-luot", { roundId: null, detail: { truoc: null, sau: "a" } }), "activity_sach"],
    ["xin-viet co chi tiet", (s) => hangMoi(s, "xin-viet", { roundId: null, detail: { den: 1 } }), "activity_detail"],
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
      "da-doc", "dang-trang", "de-nghi-xoa", "doi-bia", "doi-mat-khau", "doi-nhac", "doi-ten-luot", "doi-ten-sach", "gui-thu",
      "hoi-dap", "moi-viet", "nhan-viet", "sua-trang", "tao-sach", "tha-cam-xuc", "tu-choi", "xin-viet",
    ]);
    await s.db.delete(books).where(eq(books.id, s.chung));
    expect((await s.db.select().from(activity)).map((r) => r.kind).sort()).toEqual(["doi-mat-khau", "gui-thu", "tha-cam-xuc"]);
    await s.db.delete(accounts).where(eq(accounts.id, s.seat1.id));
    expect((await s.db.select().from(activity)).map((r) => r.kind).sort()).toEqual(["gui-thu", "tha-cam-xuc"]);
    await s.db.delete(accounts).where(eq(accounts.id, s.seat2.id));
    expect(await s.db.select().from(activity)).toEqual([]);
  });
});

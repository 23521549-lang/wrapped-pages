import { describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { readSheets, seals } from "@/server/db/schema";
import { listShelf } from "@/server/library/shelf";
import { isLockedFor } from "@/server/seal/seals";
import { SHELF_MARK, type DocJson } from "@/lib/doc/types";
import { dayKey } from "@/lib/when";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";
import { luotCua, themLuot } from "../helpers/round";

/** 10 gio sang 22.09 theo gio Viet Nam. */
const SANG = new Date("2026-09-22T03:00:00.000Z");

/** Ban tham chieu cua phep chon trong SQL: 8 ky tu hex dau cua md5, so khong dau 32 bit, lay du theo so ung vien. */
function chiSo(bookId: string, viewerId: string, ngay: string, n: number): number {
  return Number.parseInt(createHash("md5").update(`${bookId}:${viewerId}:${ngay}`).digest("hex").slice(0, 8), 16) % n;
}

const cuaCuon = async (db: TestDb, viewerId: string, bookId: string, now: Date) =>
  (await listShelf(db, viewerId, now)).find((b) => b.id === bookId)!;

/** Chen thang cac to vao cuon (khong qua bindMedia), moi to mot luot: du cho phep chon, ke ca to chi co khoi media. */
async function chenTo(db: TestDb, bookId: string, ...docs: DocJson[]) {
  for (const [i, content] of docs.entries()) await themLuot(db, bookId, i + 1, [content]);
}

/** Danh dau nguoi nay da xem cac to 1 toi position cua cuon (khong qua markRead), de dung dung tinh huong can kiem. */
async function docToi(db: TestDb, accountId: string, bookId: string, position: number) {
  await db.delete(readSheets).where(and(eq(readSheets.accountId, accountId), eq(readSheets.bookId, bookId)));
  if (position >= 1) {
    await db.insert(readSheets).values(Array.from({ length: position }, (_, i) => ({ accountId, bookId, position: i + 1 })));
  }
}

const khoiAnh: DocJson = { type: "doc", content: [{ type: "anh", attrs: { id: randomUUID(), w: 1, h: 1 } }] };
const trong: DocJson = { type: "doc", content: [{ type: "paragraph" }] };
const chiXuongDong: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "hardBreak" }] }] };
const khoangTrang = to(String.fromCharCode(32, 160, 12288, 9));

/** Tai lieu mot doan, trong do phan giua mang dau doan tren ke. */
const toDau = (truoc: string, chon: string, sau: string): DocJson => ({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      ...(truoc === "" ? [] : [{ type: "text" as const, text: truoc }]),
      { type: "text" as const, text: chon, marks: [{ type: SHELF_MARK }] },
      ...(sau === "" ? [] : [{ type: "text" as const, text: sau }]),
    ],
  }],
});

describe("listShelf chon to cua doan trich", () => {
  it("chon to thu k = md5(cuon:nguoi xem:ngay Viet Nam) mod so ung vien; cung ngay tai lai van la to do", async () => {
    const s = await haiCuon();
    const chu = ["một", "hai", "ba", "bốn", "năm"];
    await dang(s.db, s.seat1.id, s.chung, ...chu);
    await docToi(s.db, s.seat2.id, s.chung, 5);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      const ke = await cuaCuon(s.db, ai, s.chung, SANG);
      expect(ke.excerptPosition).toBe(chiSo(s.chung, ai, "2026-09-22", 5) + 1);
      expect([ke.excerpt, ke.excerptLocked]).toEqual([chu[ke.excerptPosition - 1], false]);
      expect((await cuaCuon(s.db, ai, s.chung, new Date("2026-09-22T16:59:59.999Z"))).excerptPosition).toBe(ke.excerptPosition);
    }
  });

  it("ngay doi luc 0 gio Viet Nam (17:00 UTC); trong 30 ngay co it nhat hai to khac nhau", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "một", "hai", "ba", "bốn", "năm");
    const nuaDem = new Date("2026-09-22T17:00:00.000Z");
    expect(dayKey(nuaDem)).toBe("2026-09-23");
    expect((await cuaCuon(s.db, s.seat1.id, s.chung, nuaDem)).excerptPosition).toBe(chiSo(s.chung, s.seat1.id, "2026-09-23", 5) + 1);
    const daGap = new Set<number>();
    for (let d = 0; d < 30; d++) {
      const luc = new Date(Date.UTC(2026, 8, 1 + d, 3));
      const ke = await cuaCuon(s.db, s.seat1.id, s.chung, luc);
      expect(ke.excerptPosition, dayKey(luc)).toBe(chiSo(s.chung, s.seat1.id, dayKey(luc), 5) + 1);
      daGap.add(ke.excerptPosition);
    }
    expect(daGap.size).toBeGreaterThan(1);
  });

  it("luot moi nhat khong bi moc doc gioi han; chu sach cung vay", async () => {
    const s = await haiCuon();
    const chu = ["một", "hai", "ba", "bốn", "năm"];
    await dang(s.db, s.seat1.id, s.chung, ...chu);
    // Nam to nam trong MOT luot, va luot do la luot moi nhat: ca hai nguoi deu bat tham trong ca nam to, khong phu
    // thuoc da xem to nao. An toan vi markRead chi ghi to that su hien, nen mo khung o to xa khong lam mat trang moi.
    for (const ai of [s.seat1.id, s.seat2.id]) {
      for (let d = 0; d < 30; d++) {
        const luc = new Date(Date.UTC(2026, 8, 1 + d, 3));
        const ke = await cuaCuon(s.db, ai, s.chung, luc);
        expect(ke.excerptPosition, dayKey(luc)).toBe(chiSo(s.chung, ai, dayKey(luc), 5) + 1);
        expect(ke.excerpt).toBe(chu[ke.excerptPosition - 1]);
      }
    }
  });

  it("bo to chi co anh, to trong, to chi xuong dong, to chi co khoang trang (ke ca khoang trang khong ngat va chu Han)", async () => {
    const s = await haiCuon();
    await chenTo(s.db, s.chung, khoiAnh, trong, khoangTrang, to("Chữ thật"), chiXuongDong);
    // Nguoi kia chua doc gi: du phong KHONG duoc nhay qua to 1 (anh, chua doc) de toi to 4 (co chu) - vi mo tai to 4 se
    // am tham danh dau to 1..3 la da doc. Phai mo dung to 1, va vi to 1 khong co chu nen khong co doan trich.
    expect(await cuaCuon(s.db, s.seat2.id, s.chung, SANG)).toMatchObject({ excerpt: null, excerptPosition: 1, excerptLocked: false });
    await docToi(s.db, s.seat2.id, s.chung, 5);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      expect(await cuaCuon(s.db, ai, s.chung, SANG)).toMatchObject({ excerpt: "Chữ thật", excerptPosition: 4, excerptLocked: false });
    }
  });

  it("to cuoi co chu thi ca hai nguoi deu thay no, du cac to truoc chi co anh", async () => {
    const s = await haiCuon();
    // Ba luot: to 1 va to 2 chi co anh, to 3 co chu va la luot moi nhat.
    await chenTo(s.db, s.chung, khoiAnh, khoiAnh, to("Xa hơn"));
    await docToi(s.db, s.seat2.id, s.chung, 1);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      expect(await cuaCuon(s.db, ai, s.chung, SANG)).toMatchObject({ excerpt: "Xa hơn", excerptPosition: 3, excerptLocked: false });
    }
  });

  it("duong lui khong nhay qua to chua xem de toi to co chu o xa hon", async () => {
    const s = await haiCuon();
    // Luot moi nhat (to 4) chi co anh nen khong co doan trich tu no. Voi nguoi kia: to 1 (anh) da xem, to 2 (anh) chua
    // xem, to 3 co chu nhung cung chua xem - mo khung o to 3 se am tham danh dau to 2 la da doc, nen duong lui phai
    // dung lai o to 2, va vi to 2 khong co chu nen khong co doan trich (spec muc 7).
    await themLuot(s.db, s.chung, 1, [khoiAnh, khoiAnh, to("Xa hơn")]);
    await themLuot(s.db, s.chung, 4, [khoiAnh], new Date("2026-09-02T00:00:00.000Z"));
    await docToi(s.db, s.seat2.id, s.chung, 1);
    expect(await cuaCuon(s.db, s.seat2.id, s.chung, SANG)).toMatchObject({ excerpt: null, excerptPosition: 2 });
  });

  it("to trong niem phong: loai dung theo luat isLockedFor voi tung nguoi xem va tung thoi diem", async () => {
    const s = await haiCuon();
    await chenTo(s.db, s.chung, khoiAnh, to("Chữ trong niêm phong"));
    // Nguoi kia da doc toi to 2, de dau doc khong phai ly do loai to 2: chi con luat khoa quyet.
    await docToi(s.db, s.seat2.id, s.chung, 2);
    const [cauDo] = await s.db
      .insert(seals)
      .values({ bookId: s.chung, roundId: await luotCua(s.db, s.chung, 2), kind: "cau-do", question: "?", answers: ["a"], teaser: "Hé lộ" })
      .returning();
    const MO = new Date("2026-09-22T05:00:00.000Z");
    const truongHop = async (tieuDe: string) => {
      const [row] = await s.db.select().from(seals).where(eq(seals.id, cauDo.id));
      for (const [ai, mine] of [[s.seat1.id, true], [s.seat2.id, false]] as const) {
        for (const luc of [SANG, MO]) {
          const ke = await cuaCuon(s.db, ai, s.chung, luc);
          const khoa = isLockedFor(row, mine, luc);
          // Mo: to 2 la ung vien duy nhat. Khoa: khong to doc duoc nao co chu (to 1 chi co anh), nen doan trich la dong
          // he lo cua to cuoi dang khoa; man doc van mo o to doc duoc dau tien (to 1) de khong vuot to chua doc.
          expect(ke, `${tieuDe} ${mine ? "chu" : "nguoi kia"} ${luc.toISOString()}`).toMatchObject(
            khoa
              ? { excerptPosition: 1, excerptLocked: true, excerpt: "Hé lộ" }
              : { excerptPosition: 2, excerptLocked: false, excerpt: "Chữ trong niêm phong" },
          );
        }
      }
    };
    await truongHop("cau do chua mo");
    await s.db.update(seals).set({ openedAt: SANG }).where(eq(seals.id, cauDo.id));
    await truongHop("cau do da mo");
    await s.db.update(seals).set({ kind: "hen-gio", question: null, answers: [], hints: [], openedAt: null, opensAt: MO }).where(eq(seals.id, cauDo.id));
    await truongHop("hen gio: truoc gio mo khoa ca chu sach, dung gio mo thi mo");
  });

  it("khong to nao co chu: khong co doan trich, mo o to doc duoc dau tien; moi to deu khoa thi dong he lo cua to cuoi; chua co to thi khong gi", async () => {
    const s = await haiCuon();
    await chenTo(s.db, s.chung, khoiAnh, trong);
    // Nhan media khong phai doan van: khong co to co chu thi khong co doan trich.
    for (const ai of [s.seat1.id, s.seat2.id]) {
      expect(await cuaCuon(s.db, ai, s.chung, SANG)).toMatchObject({ excerpt: null, excerptPosition: 1, excerptLocked: false });
    }
    expect(await cuaCuon(s.db, s.seat1.id, s.rieng, SANG)).toMatchObject({ excerpt: null, excerptPosition: 0, excerptLocked: false });

    const roundId = await themLuot(s.db, s.rieng, 1, [to("Hé lộ trước"), to("Bí mật")]);
    await s.db.insert(seals).values({
      bookId: s.rieng, roundId, kind: "hen-gio", opensAt: new Date("2030-01-01T00:00:00.000Z"), teaser: "Hé lộ trước",
    });
    const ke = await cuaCuon(s.db, s.seat1.id, s.rieng, SANG);
    expect(ke).toMatchObject({ excerpt: "Hé lộ trước", excerptPosition: 2, excerptLocked: true });
    expect(JSON.stringify(ke)).not.toContain("Bí mật");
  });

  it("sach rieng tu cua nguoi kia khong xuat hien, ke ca chu cua to duoc chon", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.rieng, "Chỉ mình em biết");
    const ke = await listShelf(s.db, s.seat2.id, SANG);
    expect(ke.map((b) => b.id)).toEqual([s.chung]);
    expect(JSON.stringify(ke)).not.toContain("Chỉ mình em biết");
  });
});

describe("listShelf lay doan tu luot moi nhat", () => {
  it("co dau chon thi lay dung doan do, khong bat tham, ngay nao cung the", async () => {
    const s = await haiCuon();
    await themLuot(s.db, s.chung, 1, [to("Tờ một"), toDau("Trước ", "đoạn em chọn", " sau"), to("Tờ ba")]);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      for (const luc of [SANG, new Date("2026-10-05T03:00:00.000Z")]) {
        expect(await cuaCuon(s.db, ai, s.chung, luc), luc.toISOString()).toMatchObject({
          excerpt: "đoạn em chọn", excerptPosition: 2, excerptLocked: false,
        });
      }
    }
  });

  it("dau nam tren nhieu to thi lay to co vi tri nho nhat", async () => {
    const s = await haiCuon();
    await themLuot(s.db, s.chung, 1, [toDau("", "phần đầu", ""), toDau("", "phần sau", "")]);
    expect(await cuaCuon(s.db, s.seat1.id, s.chung, SANG)).toMatchObject({ excerpt: "phần đầu", excerptPosition: 1 });
  });

  it("chu duoc danh dau chi toan khoang trang thi lui ve bat tham", async () => {
    const s = await haiCuon();
    await themLuot(s.db, s.chung, 1, [toDau("Có chữ hẳn hoi", String.fromCharCode(32, 160), "")]);
    expect(await cuaCuon(s.db, s.seat1.id, s.chung, SANG)).toMatchObject({ excerpt: "Có chữ hẳn hoi", excerptPosition: 1 });
  });

  it("to mang dau dau tien chi co khoang trang: lay to mang dau ke tiep, khong lui ve bat tham", async () => {
    const s = await haiCuon();
    // Keo chon theo tu trong trinh duyet thuong om luon dau cach dau doan: bo xep trang cat ngay sau dau cach, nen to 1
    // chi mang " " va khoang trang khong ngat co dau, con cau that nam o to 2. Khung phai hien dung cau that.
    await themLuot(s.db, s.chung, 1, [
      toDau("", String.fromCharCode(32, 160), ""),
      toDau("", "câu em thật sự chọn", ""),
      to("Tờ ba"),
      to("Tờ bốn"),
    ]);
    for (const ai of [s.seat1.id, s.seat2.id]) {
      for (let d = 0; d < 20; d++) {
        const luc = new Date(Date.UTC(2026, 8, 1 + d, 3));
        expect(await cuaCuon(s.db, ai, s.chung, luc), dayKey(luc)).toMatchObject({
          excerpt: "câu em thật sự chọn", excerptPosition: 2, excerptLocked: false,
        });
      }
    }
  });

  it("luot moi nhat khong giu doan cua luot cu, ke ca khi luot cu co dau chon", async () => {
    const s = await haiCuon();
    await themLuot(s.db, s.chung, 1, [toDau("", "đoạn của lượt cũ", "")]);
    await themLuot(s.db, s.chung, 2, [to("Lượt mới một"), to("Lượt mới hai")], new Date("2026-09-02T00:00:00.000Z"));
    const ke = await cuaCuon(s.db, s.seat1.id, s.chung, SANG);
    expect(ke.excerptPosition).toBe(2 + chiSo(s.chung, s.seat1.id, "2026-09-22", 2));
    expect(ke.excerpt).toBe(["Lượt mới một", "Lượt mới hai"][ke.excerptPosition - 2]);
  });

  it("dau nam trong luot con niem phong: khong hien mot chu nao, dung dong he lo", async () => {
    const s = await haiCuon();
    await themLuot(s.db, s.chung, 1, [to("Tờ mở")]);
    const roundId = await themLuot(s.db, s.chung, 2, [toDau("", "đoạn còn khóa", "")], new Date("2026-09-02T00:00:00.000Z"));
    await s.db.insert(seals).values({
      bookId: s.chung, roundId, kind: "cau-do", question: "?", answers: ["a"], teaser: "Hé lộ",
    });
    const ke = await cuaCuon(s.db, s.seat2.id, s.chung, SANG);
    expect(ke).toMatchObject({ excerpt: "Hé lộ", excerptLocked: true, excerptPosition: 1 });
    expect(JSON.stringify(ke)).not.toContain("đoạn còn khóa");
  });

  it("luot moi nhat khong co to nao co chu: lui ve luat cu, chi bat tham trong cac to da xem", async () => {
    const s = await haiCuon();
    await themLuot(s.db, s.chung, 1, [to("Tờ một"), to("Tờ hai"), to("Tờ ba")]);
    await themLuot(s.db, s.chung, 4, [khoiAnh], new Date("2026-09-02T00:00:00.000Z"));
    // Chua xem to nao: duong lui khong bao gio chon xa hon to doc duoc dau tien, nen la to 1 chu khong phai to bam
    // theo ngay - dung luat cu cua spec muc 7.
    expect(await cuaCuon(s.db, s.seat2.id, s.chung, SANG)).toMatchObject({ excerpt: "Tờ một", excerptPosition: 1 });
    await docToi(s.db, s.seat2.id, s.chung, 3);
    const ke = await cuaCuon(s.db, s.seat2.id, s.chung, SANG);
    expect(ke.excerptPosition).toBe(chiSo(s.chung, s.seat2.id, "2026-09-22", 3) + 1);
    expect(ke.excerptPosition).toBeLessThanOrEqual(3);
  });
});

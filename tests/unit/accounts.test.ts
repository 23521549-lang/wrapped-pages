import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import { readSeatState, createSeat, mayCreateNextSeat, SeatsFullError } from "@/server/identity/accounts";
import { accounts, secretHistory } from "@/server/db/schema";
import { PASSWORD_SHAPE } from "@/server/identity/password";

const KEY = "khoa-test";
const mk = (over: Partial<Parameters<typeof createSeat>[1]> = {}) => ({
  nickname: "Linh", secret: "ben xe", deviceId: "dev-a", serverKey: KEY, ...over,
});

describe("createSeat", () => {
  it("web trong thi trang thai la trong", async () => {
    const db = await makeTestDb();
    expect(await readSeatState(db)).toEqual({ phase: "trong" });
  });

  it("tao cho ngoi dau tien thi duoc so 1 va tra ve mat khau dung dinh dang", async () => {
    const db = await makeTestDb();
    const r = await createSeat(db, mk());
    expect(r.seat).toBe(1);
    expect(r.password).toMatch(PASSWORD_SHAPE);
  });

  it("sau mot lan tao thi trang thai la mot-nguoi", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk());
    expect(await readSeatState(db)).toEqual({ phase: "mot-nguoi", takenSeat: 1 });
  });

  it("tao cho ngoi thu hai thi duoc so 2", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk());
    const r = await createSeat(db, mk({ nickname: "Manh", secret: "hien nha", deviceId: "dev-b" }));
    expect(r.seat).toBe(2);
    expect(await readSeatState(db)).toEqual({ phase: "du-hai" });
  });

  it("tao cho ngoi thu ba thi bi tu choi", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk());
    await createSeat(db, mk({ nickname: "Manh", secret: "hien nha", deviceId: "dev-b" }));
    await expect(
      createSeat(db, mk({ nickname: "Ai Do", secret: "gi do", deviceId: "dev-c" })),
    ).rejects.toThrow("da du hai cho ngoi");
  });

  it("tao cho ngoi thu ba thi nem dung loai SeatsFullError, giu nguyen thong diep", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk());
    await createSeat(db, mk({ nickname: "Manh", secret: "hien nha", deviceId: "dev-b" }));
    const e = await createSeat(db, mk({ nickname: "Ai Do", secret: "gi do", deviceId: "dev-c" }))
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SeatsFullError);
    expect((e as Error).message).toBe("da du hai cho ngoi");
  });

  it("khong luu loi nhan duoi dang chu thuong trong database", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk({ secret: "mot cau rat rieng tu" }));
    const [row] = await db.select().from(accounts);
    expect(row.secretCipher).not.toContain("mot cau rat rieng tu");
  });

  it("luu lai dau thiet bi cua nguoi tao", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk({ deviceId: "dev-a" }));
    const [row] = await db.select().from(accounts);
    expect(row.createdByDevice).toBe("dev-a");
  });

  it("neu mat khau trung voi cho ngoi kia thi sinh lai bang counter", async () => {
    const db = await makeTestDb();
    // ep trung: dung cung biet danh va cung loi nhan cho ca hai cho ngoi
    const a = await createSeat(db, mk({ nickname: "Same", secret: "same" }));
    const b = await createSeat(db, mk({ nickname: "Same", secret: "same", deviceId: "dev-b" }));
    expect(b.password).not.toBe(a.password);
  });

  it("tao thanh cong thi co dung mot dong lich su loi nhan cho cho ngoi do", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk());
    const [acc] = await db.select().from(accounts);
    const hist = await db.select().from(secretHistory);
    expect(hist).toHaveLength(1);
    expect(hist[0].accountId).toBe(acc.id);
    expect(hist[0].secretCipher).toBe(acc.secretCipher);
  });

  it("neu ghi lich su that bai thi khong de lai cho ngoi mo coi", async () => {
    const db = await makeTestDb();
    // Ep moi lenh ghi vao secret_history deu hong, khong dung toi du lieu cu.
    await db.execute(sql`alter table secret_history add constraint ep_loi check (false) not valid`);
    try {
      await expect(createSeat(db, mk())).rejects.toThrow();
      expect(await db.select().from(accounts)).toHaveLength(0);
    } finally {
      await db.execute(sql`alter table secret_history drop constraint ep_loi`);
    }
  });
});

describe("mayCreateNextSeat", () => {
  it("chua co ai thi nguoi mo dau duoc tao", () => {
    expect(mayCreateNextSeat({ phase: "trong" }, null)).toBe(true);
  });
  it("da co cho 1 thi nguoi chua dang nhap KHONG duoc tao, ke ca nguoi mo dau", () => {
    expect(mayCreateNextSeat({ phase: "mot-nguoi", takenSeat: 1 }, null)).toBe(false);
  });
  it("da co cho 1 thi nguoi dang ngoi cho 1 duoc tao cho con lai", () => {
    expect(mayCreateNextSeat({ phase: "mot-nguoi", takenSeat: 1 }, { seat: 1 })).toBe(true);
  });
  it("du hai thi khong ai duoc tao", () => {
    expect(mayCreateNextSeat({ phase: "du-hai" }, null)).toBe(false);
    expect(mayCreateNextSeat({ phase: "du-hai" }, { seat: 1 })).toBe(false);
  });
});

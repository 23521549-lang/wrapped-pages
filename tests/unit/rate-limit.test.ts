import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { ghiLanSai, trangThaiKhoa } from "../helpers/lan-sai";
import {
  beginAttempt, releaseAttempt, trustDevice,
  MAX_FAILS, WINDOW_MS, UNTRUSTED_MAX_FAILS, UNTRUSTED_WINDOW_MS, MAX_TRUSTED_PER_ACCOUNT,
} from "@/server/identity/rate-limit";
import { accounts, loginAttempts, trustedDevices } from "@/server/db/schema";

/** Mot tai khoan gia de gan trinh duyet tin cay vao (khoa ngoai). */
async function taiKhoan(db: Awaited<ReturnType<typeof makeTestDb>>, seat: 1 | 2 = 1) {
  const [row] = await db.insert(accounts).values({
    seat, nickname: `nguoi-${seat}`, passwordHash: "x", secretCipher: "x", createdByDevice: `tao-${seat}`,
  }).returning({ id: accounts.id });
  return row.id;
}

describe("gioi han dang nhap sai theo trinh duyet", () => {
  it("moi vao thi khong bi khoa", async () => {
    const db = await makeTestDb();
    expect(await trangThaiKhoa(db, "dev-a")).toBeNull();
  });

  it("sai it hon nguong thi chua khoa", async () => {
    const db = await makeTestDb();
    for (let i = 0; i < MAX_FAILS - 1; i++) await ghiLanSai(db, "dev-a");
    expect(await trangThaiKhoa(db, "dev-a")).toBeNull();
  });

  it("sai du nguong thi bi khoa", async () => {
    const db = await makeTestDb();
    for (let i = 0; i < MAX_FAILS; i++) await ghiLanSai(db, "dev-a");
    expect(await trangThaiKhoa(db, "dev-a")).toBe("bi-khoa");
  });

  it("khoa trinh duyet nay khong lam khoa trinh duyet khac", async () => {
    const db = await makeTestDb();
    for (let i = 0; i < MAX_FAILS; i++) await ghiLanSai(db, "dev-a");
    expect(await trangThaiKhoa(db, "dev-b")).toBeNull();
  });

  it("lan sai cu hon cua so thoi gian thi khong tinh nua", async () => {
    const db = await makeTestDb();
    const cu = new Date(Date.now() - WINDOW_MS - 1000);
    for (let i = 0; i < MAX_FAILS; i++) await ghiLanSai(db, "dev-a", cu);
    expect(await trangThaiKhoa(db, "dev-a")).toBeNull();
  });

  it("trinh duyet tin cay van chiu nguong rieng cua no", async () => {
    const db = await makeTestDb();
    await trustDevice(db, { deviceId: "may-quen", accountId: await taiKhoan(db) });
    for (let i = 0; i < MAX_FAILS; i++) await ghiLanSai(db, "may-quen");
    expect(await trangThaiKhoa(db, "may-quen")).toBe("bi-khoa");
  });
});

describe("nguong chung cho trinh duyet la (chua tung dang nhap thanh cong)", () => {
  it("lo hong cu: moi lan mot cookie moi, sai mot lan - toi nguong thi ca trinh duyet moi tinh cung bi chan", async () => {
    const db = await makeTestDb();
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) await ghiLanSai(db, `ke-xau-${i}`);
    expect(await trangThaiKhoa(db, "cookie-vua-tao")).toBe("khoa-chung");
  });

  it("duoi nguong chung thi trinh duyet la moi tinh van vao duoc", async () => {
    const db = await makeTestDb();
    for (let i = 0; i < UNTRUSTED_MAX_FAILS - 1; i++) await ghiLanSai(db, `ke-xau-${i}`);
    expect(await trangThaiKhoa(db, "cookie-vua-tao")).toBeNull();
  });

  it("trinh duyet tin cay khong bi khoa boi mot tran sai tu trinh duyet la, ke ca khi no cung vua sai", async () => {
    const db = await makeTestDb();
    await trustDevice(db, { deviceId: "may-quen", accountId: await taiKhoan(db) });
    for (let i = 0; i < UNTRUSTED_MAX_FAILS * 5; i++) await ghiLanSai(db, `ke-xau-${i}`);
    await ghiLanSai(db, "may-quen");
    expect(await trangThaiKhoa(db, "may-quen")).toBeNull();
  });

  it("lan sai cua trinh duyet tin cay khong gop vao nguong chung", async () => {
    const db = await makeTestDb();
    const id = await taiKhoan(db);
    await trustDevice(db, { deviceId: "may-quen-1", accountId: id });
    await trustDevice(db, { deviceId: "may-quen-2", accountId: id });
    await trustDevice(db, { deviceId: "may-quen-3", accountId: id });
    for (const may of ["may-quen-1", "may-quen-2", "may-quen-3"]) {
      for (let i = 0; i < MAX_FAILS - 1; i++) await ghiLanSai(db, may);
    }
    expect(3 * (MAX_FAILS - 1)).toBeGreaterThanOrEqual(UNTRUSTED_MAX_FAILS);
    expect(await trangThaiKhoa(db, "cookie-vua-tao")).toBeNull();
  });

  it("nguong chung dem ca lan sai cu hon cua so theo trinh duyet nhung con trong cua so chung", async () => {
    const db = await makeTestDb();
    expect(UNTRUSTED_WINDOW_MS).toBeGreaterThan(WINDOW_MS);
    const giua = new Date(Date.now() - WINDOW_MS - 60_000);
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) await ghiLanSai(db, `ke-xau-${i}`, giua);
    expect(await trangThaiKhoa(db, "cookie-vua-tao")).toBe("khoa-chung");
  });

  it("lan sai cu hon cua so chung thi khong tinh", async () => {
    const db = await makeTestDb();
    const cu = new Date(Date.now() - UNTRUSTED_WINDOW_MS - 1000);
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) await ghiLanSai(db, `ke-xau-${i}`, cu);
    expect(await trangThaiKhoa(db, "cookie-vua-tao")).toBeNull();
  });

  it("ghi mot lan sai moi thi don cac dong cu hon cua so dai nhat, giu lai dong con trong cua so chung", async () => {
    const db = await makeTestDb();
    await db.insert(loginAttempts).values([
      { deviceId: "cu-1", at: new Date(Date.now() - UNTRUSTED_WINDOW_MS - 60_000) },
      { deviceId: "cu-2", at: new Date(Date.now() - UNTRUSTED_WINDOW_MS - 60_000) },
      { deviceId: "giua", at: new Date(Date.now() - WINDOW_MS - 60_000) },
    ]);
    const lan = await beginAttempt(db, "moi");
    expect("id" in lan).toBe(true);
    const rows = await db.select().from(loginAttempts);
    expect(rows.map((r) => r.deviceId).sort()).toEqual(["giua", "moi"]);
  });
});

describe("giu cho truoc khi thu mat khau (beginAttempt)", () => {
  it("chua khoa thi giu mot dong, tha ra thi dong do bien mat", async () => {
    const db = await makeTestDb();
    const lan = await beginAttempt(db, "dev-a");
    expect("id" in lan).toBe(true);
    expect(await db.select().from(loginAttempts)).toHaveLength(1);
    if ("id" in lan) await releaseAttempt(db, lan.id);
    expect(await db.select().from(loginAttempts)).toHaveLength(0);
  });

  it("dang khoa thi tra ly do va khong de lai dong nao: go mai khi bi khoa khong lam bang phinh ra", async () => {
    const db = await makeTestDb();
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) await ghiLanSai(db, `ke-xau-${i}`);
    for (let i = 0; i < 30; i++) {
      expect(await beginAttempt(db, `cookie-moi-${i}`)).toEqual({ lock: "khoa-chung" });
    }
    for (let i = 0; i < MAX_FAILS; i++) await ghiLanSai(db, "may-quen");
    await trustDevice(db, { deviceId: "may-quen", accountId: await taiKhoan(db) });
    expect(await beginAttempt(db, "may-quen")).toEqual({ lock: "bi-khoa" });
    expect(await db.select().from(loginAttempts)).toHaveLength(UNTRUSTED_MAX_FAILS + MAX_FAILS);
  });

  it("nhieu lan thu dong thoi tu trinh duyet la khong lot qua nguong chung", async () => {
    // PGlite chi co mot ket noi, moi lenh chay noi tiep nhau, nen test nay KHONG tao duoc canh hai
    // yeu cau xen ke that tren Postgres; no chi giu cho ket qua dung khi goi song song tu mot tien trinh.
    // Ly do dung tren Postgres that (READ COMMITTED) nam o chu thich cua beginAttempt: dong cua lan
    // lot qua duoc commit truoc lenh dem cua yeu cau sau va khong bi xoa, nen yeu cau thu k+1 thay k+1 dong.
    const db = await makeTestDb();
    const ket = await Promise.all(
      Array.from({ length: UNTRUSTED_MAX_FAILS * 3 }, (_, i) => beginAttempt(db, `dong-thoi-${i}`)),
    );
    expect(ket.filter((k) => "id" in k).length).toBeLessThanOrEqual(UNTRUSTED_MAX_FAILS);
  });
});

describe("danh sach trinh duyet tin cay", () => {
  it("co tran theo tai khoan: chi giu cac trinh duyet dung gan nhat", async () => {
    const db = await makeTestDb();
    const id = await taiKhoan(db);
    const goc = Date.now();
    for (let i = 0; i < MAX_TRUSTED_PER_ACCOUNT + 3; i++) {
      await trustDevice(db, { deviceId: `may-${i}`, accountId: id }, new Date(goc + i * 1000));
    }
    const rows = await db.select().from(trustedDevices);
    expect(rows).toHaveLength(MAX_TRUSTED_PER_ACCOUNT);
    expect(rows.map((r) => r.deviceId)).not.toContain("may-0");
    expect(rows.map((r) => r.deviceId)).toContain(`may-${MAX_TRUSTED_PER_ACCOUNT + 2}`);
  });

  it("dang nhap lai tren trinh duyet cu thi lam moi, khong tao dong thu hai", async () => {
    const db = await makeTestDb();
    const a = await taiKhoan(db, 1);
    const b = await taiKhoan(db, 2);
    await trustDevice(db, { deviceId: "may-chung", accountId: a });
    await trustDevice(db, { deviceId: "may-chung", accountId: b });
    const rows = await db.select().from(trustedDevices);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).toBe(b);
  });
});

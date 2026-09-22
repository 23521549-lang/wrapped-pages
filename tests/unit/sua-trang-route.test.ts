import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/sach/[id]/sua-trang/[so]/route";

/*
 * Duong dan cu cua man sua mot to. Moi mo dun may chu la gia; o day chi kiem ma trang thai, dich, header va rang so trang
 * sai dang khong bao gio cham database.
 */

const { requireMe, roundOfPosition, notFound } = vi.hoisted(() => ({
  requireMe: vi.fn(),
  roundOfPosition: vi.fn(),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("khong-thay"), { khongThay: true });
  }),
}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/server/web/guard", () => ({ requireMe }));
vi.mock("@/server/library/edit-round", () => ({ roundOfPosition }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const ME = { accountId: "tai-khoan-1" };

const goi = (so: string) =>
  GET(new Request(`http://localhost:3100/sach/${SACH}/sua-trang/${so}`), { params: Promise.resolve({ id: SACH, so }) });

afterEach(() => {
  requireMe.mockReset();
  roundOfPosition.mockReset();
});

describe("duong dan cu /sach/[id]/sua-trang/[so]", () => {
  it("308 sang man sua luot chua to do, mo dung to, khong cho trinh duyet nho", async () => {
    requireMe.mockResolvedValue(ME);
    roundOfPosition.mockResolvedValue({ ordinal: 2, sheet: 3 });
    const res = await goi("8");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(`http://localhost:3100/sach/${SACH}/sua-luot/2?trang=3`);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(roundOfPosition).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, SACH, 8);
  });

  it("to dau cua luot: dich khong kem ?trang", async () => {
    requireMe.mockResolvedValue(ME);
    roundOfPosition.mockResolvedValue({ ordinal: 1, sheet: 1 });
    expect((await goi("1")).headers.get("location")).toBe(`http://localhost:3100/sach/${SACH}/sua-luot/1`);
  });

  it.each(["0", "01", "1e3", "abc", "123456"])("so trang sai dang %s: 404, khong doc database", async (so) => {
    requireMe.mockResolvedValue(ME);
    await expect(goi(so)).rejects.toMatchObject({ khongThay: true });
    expect(roundOfPosition).not.toHaveBeenCalled();
  });

  it("sach cua nguoi kia, sach la hay to la: 404", async () => {
    requireMe.mockResolvedValue(ME);
    roundOfPosition.mockResolvedValue(null);
    await expect(goi("2")).rejects.toMatchObject({ khongThay: true });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { actionGuiThu, actionMoThu, actionThuChuaMo } from "@/app/actions/thu";
import { CAN_DANG_NHAP } from "@/app/actions/messages";

/*
 * Action thu thang tren ham gia: luat da duoc thu-server.test.ts kiem tren database. O day chi kiem: nguoi dang nhap
 * truoc, id tai khoan lay tu phien (khong bao gio tu trinh duyet), cau loi cua tung ket qua, va gio gui da thanh chu.
 * Gui xong KHONG refresh(): trang cho chim bay xong roi moi tu lam moi.
 */

const { readMe, guiThu, moThu, thuChuaMo, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  guiThu: vi.fn(),
  moThu: vi.fn(),
  thuChuaMo: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/thu/thu", () => ({ guiThu, moThu, thuChuaMo }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-2", seat: 2, nickname: "Linh", partnerNickname: "Mạnh" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("actionGuiThu", () => {
  it("chua dang nhap thi bao loi, khong goi may chu", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionGuiThu("2026-09", "Thư")).toEqual({ error: CAN_DANG_NHAP });
    expect(guiThu).not.toHaveBeenCalled();
  });

  it("gui duoc: goi may chu voi tai khoan cua phien, tra ok, khong refresh", async () => {
    readMe.mockResolvedValue(ME);
    guiThu.mockResolvedValue("sent");
    expect(await actionGuiThu("2026-09", "Thư")).toEqual({ ok: true });
    expect(guiThu).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, "2026-09", "Thư");
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["exists", "Bạn đã gửi thư tháng này rồi."],
    ["open", "Tháng này chưa khép, ngày 1 tháng sau mới viết được thư."],
    ["invalid", "Thư cần có chữ, tối đa 1000 ký tự."],
  ] as const)("%s: bao dung cau", async (ket, cau) => {
    readMe.mockResolvedValue(ME);
    guiThu.mockResolvedValue(ket);
    expect(await actionGuiThu("2026-09", "x")).toEqual({ error: cau });
  });
});

describe("actionThuChuaMo, actionMoThu", () => {
  it("chua dang nhap: khong co thu nao, khong mo duoc", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionThuChuaMo()).toBeNull();
    expect(await actionMoThu("2026-09")).toEqual({ error: CAN_DANG_NHAP });
    expect(thuChuaMo).not.toHaveBeenCalled();
    expect(moThu).not.toHaveBeenCalled();
  });

  it("la chua mo cua nguoi dang nhap", async () => {
    readMe.mockResolvedValue(ME);
    thuChuaMo.mockResolvedValue({ id: "thu-1", thang: "2026-09" });
    expect(await actionThuChuaMo()).toEqual({ id: "thu-1", thang: "2026-09" });
    expect(thuChuaMo).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId);
  });

  it("mo thu: tra noi dung va gio gui da thanh chu; khong co thu thi bao loi", async () => {
    readMe.mockResolvedValue(ME);
    moThu.mockResolvedValue({ thang: "2026-09", noiDung: "Chào cậu", guiLuc: new Date("2026-10-01T02:05:00.000Z"), minhGui: false });
    const r = await actionMoThu("2026-09");
    expect(r).toEqual({ thu: { thang: "2026-09", noiDung: "Chào cậu", gio: expect.stringContaining("09:05"), minhGui: false } });
    expect(moThu).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, "2026-09", expect.any(Date));
    moThu.mockResolvedValue(null);
    expect(await actionMoThu("2026-08")).toEqual({ error: "Không tìm thấy thư này." });
  });
});

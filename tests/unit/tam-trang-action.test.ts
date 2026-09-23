import { afterEach, describe, expect, it, vi } from "vitest";
import { actionSetMood, actionWithdrawMood } from "@/app/actions/mood";
import { CAN_DANG_NHAP } from "@/app/actions/messages";
import { CHON_TROI, NHAN_DAI } from "@/lib/tam-trang/input";

/*
 * Action tam trang tren ham gia: guard that can cookie cua request, luat database da duoc tam-trang-moods.test.ts kiem.
 * O day chi kiem thu tu: nguoi dang nhap truoc, dau vao sau, roi moi ghi, ghi xong moi refresh(). Khong bao gio nhan
 * accountId tu trinh duyet.
 */

const { readMe, setMood, withdrawMood, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  setMood: vi.fn(),
  withdrawMood: vi.fn(async () => true),
  refresh: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/mood/moods", () => ({ setMood, withdrawMood }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-1", seat: 1, nickname: "Mạnh", partnerNickname: "Linh" };

afterEach(() => {
  readMe.mockReset();
  setMood.mockReset();
  withdrawMood.mockClear();
  refresh.mockClear();
});

describe("actionSetMood", () => {
  it("chua dang nhap: bao loi, khong ghi, khong refresh", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionSetMood("nang-am", "")).toEqual({ error: CAN_DANG_NHAP });
    expect(setMood).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("kieu troi la hay loi nhan qua dai: bao dung cau, khong ghi", async () => {
    readMe.mockResolvedValue(ME);
    expect(await actionSetMood("bao", "")).toEqual({ error: CHON_TROI });
    expect(await actionSetMood("nang-am", "a".repeat(81))).toEqual({ error: NHAN_DAI });
    expect(setMood).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("hop le: ghi cho dung nguoi dang dang nhap voi loi nhan da chuan hoa, ghi xong moi refresh", async () => {
    readMe.mockResolvedValue(ME);
    setMood.mockResolvedValue({ id: "m1" });
    expect(await actionSetMood("mua-phun", "  Nhớ cậu  ")).toEqual({ ok: true });
    expect(setMood).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, "mua-phun", "Nhớ cậu");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setMood.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });

  it("tai khoan vua mat giua chung: bao can dang nhap, khong refresh", async () => {
    readMe.mockResolvedValue(ME);
    setMood.mockResolvedValue(null);
    expect(await actionSetMood("giong", null)).toEqual({ error: CAN_DANG_NHAP });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("actionWithdrawMood", () => {
  it("chua dang nhap: bao loi, khong ghi", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionWithdrawMood()).toEqual({ error: CAN_DANG_NHAP });
    expect(withdrawMood).not.toHaveBeenCalled();
  });

  it("thu lai cua chinh nguoi dang dang nhap roi refresh; khong con gi de thu van ok", async () => {
    readMe.mockResolvedValue(ME);
    expect(await actionWithdrawMood()).toEqual({ ok: true });
    expect(withdrawMood).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId);
    withdrawMood.mockResolvedValueOnce(false);
    expect(await actionWithdrawMood()).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

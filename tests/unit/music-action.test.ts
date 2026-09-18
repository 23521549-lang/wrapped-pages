import { afterEach, describe, expect, it, vi } from "vitest";
import { actionSetMusicMuted } from "@/app/actions/music";
import { CAN_DANG_NHAP, CHUA_LUU_NHAC } from "@/app/actions/messages";

/*
 * Action tat nhac tren ham gia: guard that can cookie cua request, database that da duoc prefs.test.ts kiem.
 * O day chi kiem thu tu cua action: nguoi dang nhap truoc, kieu cua muted sau, roi moi ghi, ghi xong moi refresh().
 */

const { readMe, setMusicMuted, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  setMusicMuted: vi.fn(async () => {}),
  refresh: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/identity/prefs", () => ({ setMusicMuted }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-1", seat: 1, nickname: "Linh", partnerNickname: "Manh" };

afterEach(() => {
  readMe.mockReset();
  setMusicMuted.mockClear();
  refresh.mockClear();
});

describe("actionSetMusicMuted", () => {
  it("chua dang nhap thi bao loi, khong ghi va khong refresh", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionSetMusicMuted(true)).toEqual({ error: CAN_DANG_NHAP });
    expect(setMusicMuted).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("chua dang nhap ma muted cung khong phai boolean: kiem nguoi dung truoc, bao can dang nhap", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionSetMusicMuted("true" as unknown as boolean)).toEqual({ error: CAN_DANG_NHAP });
    expect(setMusicMuted).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([["chuoi", "true"], ["so", 1], ["null", null], ["doi tuong", {}]])(
    "muted khong phai boolean (%s) thi bao loi, khong ghi va khong refresh",
    async (_ten, muted) => {
      readMe.mockResolvedValue(ME);
      expect(await actionSetMusicMuted(muted as boolean)).toEqual({ error: CHUA_LUU_NHAC });
      expect(setMusicMuted).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it.each([[true], [false]])("muted = %s thi ghi dung dong cua nguoi dang dang nhap, ghi xong moi refresh", async (muted) => {
    readMe.mockResolvedValue(ME);
    expect(await actionSetMusicMuted(muted)).toEqual({ ok: true });
    expect(setMusicMuted).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, muted);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setMusicMuted.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });
});

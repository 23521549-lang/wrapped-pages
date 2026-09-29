import { afterEach, describe, expect, it, vi } from "vitest";
import { actionPhienBanKe, actionSeenActivity } from "@/app/actions/feed";
import { CAN_DANG_NHAP } from "@/app/actions/messages";

/*
 * Action "da xem" va phien ban Ke sach tren ham gia: luat database o feed-seen.test.ts va phien-ban-ke.test.ts. O day chi
 * kiem: nguoi dang nhap truoc, chi chuoi duoc chuyen xuong markSeen, nguoi xem luon la readMe(). Khong refresh(): dau
 * Moi tan tai cho, trang khong ve lai.
 */

const { readMe, markSeen, phienBanKe, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  markSeen: vi.fn(async () => undefined),
  phienBanKe: vi.fn(async () => "3|1700000000000|0|"),
  refresh: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/feed/seen", () => ({ markSeen }));
vi.mock("@/server/feed/version", () => ({ phienBanKe }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-1", seat: 1, nickname: "Mạnh", partnerNickname: "Linh" };
const ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  readMe.mockReset();
  markSeen.mockClear();
  refresh.mockClear();
});

describe("actionSeenActivity", () => {
  it("chua dang nhap: bao loi, khong ghi", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionSeenActivity([ID])).toEqual({ error: CAN_DANG_NHAP });
    expect(markSeen).not.toHaveBeenCalled();
  });

  it("chi chuoi di xuong markSeen cho dung nguoi dang nhap; khong refresh", async () => {
    readMe.mockResolvedValue(ME);
    expect(await actionSeenActivity([ID, 7, null, { id: ID }, "x"])).toEqual({ ok: true });
    expect(markSeen).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, [ID, "x"]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("dau vao khong phai mang: khong ghi gi, van ok", async () => {
    readMe.mockResolvedValue(ME);
    expect(await actionSeenActivity("tat-ca")).toEqual({ ok: true });
    expect(markSeen).not.toHaveBeenCalled();
  });
});

describe("actionPhienBanKe", () => {
  it("chua dang nhap thi chuoi rong; dang nhap thi phien ban cua dung nguoi dang nhap", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionPhienBanKe()).toBe("");
    expect(phienBanKe).not.toHaveBeenCalled();
    readMe.mockResolvedValue(ME);
    expect(await actionPhienBanKe()).toBe("3|1700000000000|0|");
    expect(phienBanKe).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId);
    expect(refresh).not.toHaveBeenCalled();
  });
});

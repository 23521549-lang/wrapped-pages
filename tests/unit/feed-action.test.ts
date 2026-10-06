import { afterEach, describe, expect, it, vi } from "vitest";
import { actionAnHoatDong, actionPhienBanKe, actionSeenActivity } from "@/app/actions/feed";
import { CAN_DANG_NHAP, CHUA_LUU_HOAT_DONG } from "@/app/actions/messages";

/*
 * Action "da xem" va phien ban Ke sach tren ham gia: luat database o feed-seen.test.ts va phien-ban-ke.test.ts. O day chi
 * kiem: nguoi dang nhap truoc, chi chuoi duoc chuyen xuong markSeen, nguoi xem luon la readMe(). Khong refresh(): dau
 * Moi tan tai cho, trang khong ve lai.
 */

const { readMe, markSeen, phienBanKe, refresh, setAnHoatDong } = vi.hoisted(() => ({
  readMe: vi.fn(),
  markSeen: vi.fn(async () => undefined),
  phienBanKe: vi.fn(async () => "3|1700000000000|0|"),
  refresh: vi.fn(),
  setAnHoatDong: vi.fn(async () => undefined),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/feed/seen", () => ({ markSeen }));
vi.mock("@/server/feed/version", () => ({ phienBanKe }));
vi.mock("@/server/identity/prefs", () => ({ setAnHoatDong }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-1", seat: 1, nickname: "Mạnh", partnerNickname: "Linh" };
const ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  readMe.mockReset();
  markSeen.mockClear();
  refresh.mockClear();
  setAnHoatDong.mockClear();
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

/*
 * An hoat dong (06/10): `an` den tu trinh duyet nen phai la boolean that, nhu actionSetMusicMuted. Luu xong thi
 * refresh(): Next bo payload cu, nen Ke sach ve lai voi khung Hoat dong da loc va dong nhac dung trang thai moi.
 */
describe("actionAnHoatDong", () => {
  it("chua dang nhap: bao loi, khong ghi, khong refresh", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionAnHoatDong(true)).toEqual({ error: CAN_DANG_NHAP });
    expect(setAnHoatDong).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("gia tri khong phai boolean: tu choi, khong ghi, khong refresh", async () => {
    readMe.mockResolvedValue(ME);
    for (const hong of ["co", 1, null, undefined, {}]) {
      expect(await actionAnHoatDong(hong as unknown as boolean)).toEqual({ error: CHUA_LUU_HOAT_DONG });
    }
    expect(setAnHoatDong).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("bat va tat deu luu cho dung nguoi dang nhap, roi refresh", async () => {
    readMe.mockResolvedValue(ME);
    expect(await actionAnHoatDong(true)).toEqual({ ok: true });
    expect(setAnHoatDong).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await actionAnHoatDong(false)).toEqual({ ok: true });
    expect(setAnHoatDong).toHaveBeenLastCalledWith({ la: "db-gia" }, ME.accountId, false);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

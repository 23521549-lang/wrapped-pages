import { afterEach, describe, expect, it, vi } from "vitest";
import { actionSubmitRoundReply } from "@/app/actions/round-reply";
import { CAN_DANG_NHAP } from "@/app/actions/messages";

/*
 * Action gui loi hoi dap tren ham gia: luat da duoc round-replies.test.ts kiem tren database. O day chi kiem thu tu:
 * nguoi dang nhap truoc, id tai khoan lay tu phien (khong bao gio tu trinh duyet), chu va loi dung tung ket qua, va
 * refresh() chi khi trang thai that cua luot da doi.
 */

const { readMe, submitRoundReply, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  submitRoundReply: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/library/round-replies", () => ({ submitRoundReply }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-2", seat: 2, nickname: "Linh", partnerNickname: "Mạnh" };
const LUOT = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";

afterEach(() => {
  readMe.mockReset();
  submitRoundReply.mockReset();
  refresh.mockClear();
});

describe("actionSubmitRoundReply", () => {
  it("chua dang nhap thi bao loi, khong goi may chu, khong refresh", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionSubmitRoundReply(LUOT, "Thương ghê.")).toEqual({ error: CAN_DANG_NHAP });
    expect(submitRoundReply).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("gui duoc: goi may chu voi tai khoan cua phien, refresh mot lan, tra ok", async () => {
    readMe.mockResolvedValue(ME);
    submitRoundReply.mockResolvedValue("sent");
    expect(await actionSubmitRoundReply(LUOT, "Thương ghê.")).toEqual({ ok: true });
    expect(submitRoundReply).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, LUOT, "Thương ghê.");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["exists", "Lượt này đã có lời hồi đáp rồi.", 1],
    ["sealed", "Lượt này còn niêm phong, mở rồi hãy hồi đáp nhé.", 1],
    ["not-found", "Không tìm thấy lượt này.", 0],
    ["invalid", "Lời hồi đáp cần có chữ, tối đa 1000 ký tự.", 0],
  ] as const)("%s: bao dung cau, refresh %i lan", async (ket, cau, soLan) => {
    readMe.mockResolvedValue(ME);
    submitRoundReply.mockResolvedValue(ket);
    expect(await actionSubmitRoundReply(LUOT, "x")).toEqual({ error: cau });
    expect(refresh).toHaveBeenCalledTimes(soLan);
  });
});

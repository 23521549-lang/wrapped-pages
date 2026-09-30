import { afterEach, describe, expect, it, vi } from "vitest";
import { actionCamXucChoToi, actionDaXemCamXuc, actionThaCamXuc } from "@/app/actions/cam-xuc";
import { CAN_DANG_NHAP, CHO_THA_TIEP, CHON_CAM_XUC } from "@/app/actions/messages";

/*
 * Action kho cam xuc tren ham gia: luat da duoc cam-xuc-server.test.ts kiem tren database. O day chi kiem: nguoi dang
 * nhap truoc, id tai khoan lay tu phien (khong bao gio tu trinh duyet), cau loi cua tung ket qua, id la thi khong goi
 * may chu, va KHONG refresh().
 */

const { readMe, thaCamXuc, camXucChoToi, daXemCamXuc, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  thaCamXuc: vi.fn(),
  camXucChoToi: vi.fn(),
  daXemCamXuc: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/cam-xuc/cam-xuc", () => ({ thaCamXuc, camXucChoToi, daXemCamXuc }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-2", seat: 2, nickname: "Mạnh", partnerNickname: "Linh" };
const ID = "5b8f2a3e-1c4d-4e6f-8a9b-0c1d2e3f4a5b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("actionThaCamXuc", () => {
  it("chua dang nhap thi bao loi, khong goi may chu", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionThaCamXuc("yeu")).toEqual({ error: CAN_DANG_NHAP });
    expect(thaCamXuc).not.toHaveBeenCalled();
  });

  it("tha duoc: goi may chu voi tai khoan cua phien, tra ok, khong refresh", async () => {
    readMe.mockResolvedValue(ME);
    thaCamXuc.mockResolvedValue("sent");
    expect(await actionThaCamXuc("yeu")).toEqual({ ok: true });
    expect(thaCamXuc).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, "yeu");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("cau loi theo ket qua: som, invalid", async () => {
    readMe.mockResolvedValue(ME);
    thaCamXuc.mockResolvedValueOnce("som").mockResolvedValueOnce("invalid");
    expect(await actionThaCamXuc("yeu")).toEqual({ error: CHO_THA_TIEP });
    expect(await actionThaCamXuc("ghet")).toEqual({ error: CHON_CAM_XUC });
  });
});

describe("actionCamXucChoToi", () => {
  it("chua dang nhap thi rong; dang nhap thi hang cho cua chinh nguoi do", async () => {
    readMe.mockResolvedValueOnce(null);
    expect(await actionCamXucChoToi()).toEqual([]);
    expect(camXucChoToi).not.toHaveBeenCalled();
    const hang = [{ id: ID, loai: "nho", luc: new Date("2026-10-01T02:00:00.000Z") }];
    readMe.mockResolvedValue(ME);
    camXucChoToi.mockResolvedValue(hang);
    expect(await actionCamXucChoToi()).toEqual(hang);
    expect(camXucChoToi).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId);
  });
});

describe("actionDaXemCamXuc", () => {
  it("id la hay chua dang nhap thi khong goi may chu; id dung thi danh da xem cho tai khoan cua phien", async () => {
    readMe.mockResolvedValue(ME);
    await actionDaXemCamXuc("khong-phai-uuid");
    await actionDaXemCamXuc(42);
    expect(daXemCamXuc).not.toHaveBeenCalled();
    readMe.mockResolvedValueOnce(null);
    await actionDaXemCamXuc(ID);
    expect(daXemCamXuc).not.toHaveBeenCalled();
    await actionDaXemCamXuc(ID);
    expect(daXemCamXuc).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, ID);
  });
});

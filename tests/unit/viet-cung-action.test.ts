import { afterEach, describe, expect, it, vi } from "vitest";
import { actionDeNghiXoa, actionDoiTenLuot, actionRutLai, actionTraLoi, actionXinViet } from "@/app/actions/viet-cung";
import { CAN_DANG_NHAP, KHONG_THAY_SACH } from "@/app/actions/messages";

/*
 * Server action cua sach viet cung (5c): nguoi dang nhap lay tu readMe, ket qua cua may chu thanh cau tieng Viet, thanh
 * cong thi lam moi trang dang mo; dong y xoa thi hen don rac media roi ve Ke sach.
 */

const { readMe, xinViet, traLoi, rutLai, deNghiXoa, renameRound, sweepMediaAfterResponse, redirect, refresh } = vi.hoisted(() => ({
  readMe: vi.fn(),
  xinViet: vi.fn(),
  traLoi: vi.fn(),
  rutLai: vi.fn(),
  deNghiXoa: vi.fn(),
  renameRound: vi.fn(),
  sweepMediaAfterResponse: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error(`redirect:${to}`), { di: to });
  }),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/viet-cung/de-nghi", () => ({ xinViet, traLoi, rutLai, deNghiXoa }));
vi.mock("@/server/library/edit-round", () => ({ renameRound }));
vi.mock("@/server/web/media-sweep", () => ({ sweepMediaAfterResponse }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-2", seat: 2, nickname: "Manh", partnerNickname: "Linh" };
const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const LUOT = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";

async function goi<T>(chay: () => Promise<T>): Promise<T | { di: string }> {
  try {
    return await chay();
  } catch (err) {
    if (typeof err === "object" && err !== null && "di" in err) return { di: String(err.di) };
    throw err;
  }
}

afterEach(() => {
  for (const f of [readMe, xinViet, traLoi, rutLai, deNghiXoa, renameRound, sweepMediaAfterResponse, refresh]) f.mockReset();
});

describe("chua dang nhap", () => {
  it("moi action tra CAN_DANG_NHAP va khong goi may chu", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionXinViet(BOOK)).toEqual({ error: CAN_DANG_NHAP });
    expect(await actionTraLoi(BOOK, true)).toEqual({ error: CAN_DANG_NHAP });
    expect(await actionRutLai(BOOK)).toEqual({ error: CAN_DANG_NHAP });
    expect(await actionDeNghiXoa(BOOK)).toEqual({ error: CAN_DANG_NHAP });
    expect(await actionDoiTenLuot(BOOK, LUOT, "Tên")).toEqual({ error: CAN_DANG_NHAP });
    for (const f of [xinViet, traLoi, rutLai, deNghiXoa, renameRound]) expect(f).not.toHaveBeenCalled();
  });
});

describe("actionXinViet", () => {
  it("gui hay thanh nhan loi: lam moi trang; da co de nghi, khong thay sach: cau bao", async () => {
    readMe.mockResolvedValue(ME);
    xinViet.mockResolvedValueOnce("sent").mockResolvedValueOnce("accepted").mockResolvedValueOnce("exists").mockResolvedValueOnce("not-found");
    expect(await actionXinViet(BOOK)).toBeUndefined();
    expect(await actionXinViet(BOOK)).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(await actionXinViet(BOOK)).toEqual({ error: "Cuốn này đang có một đề nghị chờ trả lời." });
    expect(await actionXinViet(BOOK)).toEqual({ error: KHONG_THAY_SACH });
    expect(xinViet).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, BOOK);
  });
});

describe("actionTraLoi", () => {
  it("nhan loi va tu choi: lam moi; dong y xoa: hen don rac roi ve Ke sach; khong con de nghi: cau bao", async () => {
    readMe.mockResolvedValue(ME);
    traLoi.mockResolvedValueOnce("accepted").mockResolvedValueOnce("declined");
    expect(await actionTraLoi(BOOK, true)).toBeUndefined();
    expect(await actionTraLoi(BOOK, false)).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(traLoi).toHaveBeenLastCalledWith({ la: "db-gia" }, ME.accountId, BOOK, false);
    traLoi.mockResolvedValueOnce("deleted");
    expect(await goi(() => actionTraLoi(BOOK, true))).toEqual({ di: "/ke-sach" });
    expect(sweepMediaAfterResponse).toHaveBeenCalledTimes(1);
    traLoi.mockResolvedValueOnce("not-found");
    expect(await actionTraLoi(BOOK, true)).toEqual({ error: "Đề nghị này không còn nữa." });
  });

  it("dongY khong phai boolean thi khong goi may chu", async () => {
    readMe.mockResolvedValue(ME);
    expect(await actionTraLoi(BOOK, "co" as unknown as boolean)).toEqual({ error: "Đề nghị này không còn nữa." });
    expect(traLoi).not.toHaveBeenCalled();
  });
});

describe("actionRutLai, actionDeNghiXoa", () => {
  it("rut xong lam moi; khong con: cau bao", async () => {
    readMe.mockResolvedValue(ME);
    rutLai.mockResolvedValueOnce("withdrawn").mockResolvedValueOnce("not-found");
    expect(await actionRutLai(BOOK)).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await actionRutLai(BOOK)).toEqual({ error: "Đề nghị này không còn nữa." });
  });

  it("de nghi xoa: gui xong lam moi; da co de nghi, khong thay sach: cau bao", async () => {
    readMe.mockResolvedValue(ME);
    deNghiXoa.mockResolvedValueOnce("sent").mockResolvedValueOnce("exists").mockResolvedValueOnce("not-found");
    expect(await actionDeNghiXoa(BOOK)).toBeUndefined();
    expect(await actionDeNghiXoa(BOOK)).toEqual({ error: "Cuốn này đang có một đề nghị chờ trả lời." });
    expect(await actionDeNghiXoa(BOOK)).toEqual({ error: KHONG_THAY_SACH });
  });
});

describe("actionDoiTenLuot", () => {
  it("luu hay trung ten cu: lam moi; ten hong: cau bao ten; luot khong con: cau bao", async () => {
    readMe.mockResolvedValue(ME);
    renameRound.mockResolvedValueOnce("saved").mockResolvedValueOnce("unchanged").mockResolvedValueOnce("invalid").mockResolvedValueOnce("not-found");
    expect(await actionDoiTenLuot(BOOK, LUOT, "Bánh mì")).toBeUndefined();
    expect(await actionDoiTenLuot(BOOK, LUOT, "Bánh mì")).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(await actionDoiTenLuot(BOOK, LUOT, "")).toEqual({ error: "Tên lượt phải từ 1 tới 60 ký tự." });
    expect(await actionDoiTenLuot(BOOK, LUOT, "Tên")).toEqual({ error: "Không tìm thấy lượt này." });
    expect(renameRound).toHaveBeenLastCalledWith({ la: "db-gia" }, ME.accountId, BOOK, LUOT, "Tên");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { actionDeleteBook, actionDiscardDraft, actionEditRound, actionPublish, actionUpdateBook } from "@/app/actions/library";
import { CAN_DANG_NHAP, KHONG_THAY_SACH, LUOT_VUA_SUA_NOI_KHAC } from "@/app/actions/messages";
import { DOC_LIMITS } from "@/lib/doc/validate";

/*
 * Hai day noi cua don rac media o src/app/actions/library.ts: sua sach xong va dang trang xong deu phai hen
 * sweepMediaAfterResponse. Hai cho goi do truoc day khong co test nao chay qua - book-form.test.tsx va
 * publish-bar.test.tsx deu vi.mock ca mo dun action, nen than cua action khong bao gio chay va xoa han mot trong hai
 * dong cung khong lam do test nao. Thieu don rac thi nguoi chi doi bia ma khong tai gi them se tich rac mai mai.
 *
 * Nhu media-action.test.ts: mo dun that (guard, books, drafts, kho, don rac) deu la ham gia, o day chi kiem THU TU -
 * ghi thanh cong truoc, roi moi hen don - va kiem rang moi duong that bai khong hen don.
 */

const {
  readMe, updateBook, findOwnBook, publishDraft, editRound, deleteUnpublishedBook, discardDraft,
  sweepMediaAfterResponse, redirect, refresh,
} = vi.hoisted(() => ({
  readMe: vi.fn(),
  updateBook: vi.fn(),
  findOwnBook: vi.fn(),
  publishDraft: vi.fn(),
  editRound: vi.fn(),
  deleteUnpublishedBook: vi.fn(),
  discardDraft: vi.fn(),
  sweepMediaAfterResponse: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((to: string) => {
    // redirect that cua Next nem de moi thu sau no khong chay. Giu dung tinh chat do, neu khong thi test se do qua mot
    // doan ma production khong bao gio chay toi.
    throw Object.assign(new Error(`redirect:${to}`), { di: to });
  }),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/library/books", () => ({ createBook: vi.fn(), findOwnBook, updateBook }));
vi.mock("@/server/library/drafts", () => ({ publishDraft, saveDraft: vi.fn() }));
vi.mock("@/server/library/edit-round", () => ({ editRound }));
vi.mock("@/server/library/pages", () => ({ markRead: vi.fn() }));
vi.mock("@/server/library/remove", () => ({ deleteUnpublishedBook, discardDraft }));
vi.mock("@/server/web/media-sweep", () => ({ sweepMediaAfterResponse }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ refresh }));

const ME = { accountId: "tai-khoan-1", seat: 1, nickname: "Linh", partnerNickname: "Manh" };
const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const BIA = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const TO = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Sáng" }] }] };

/** Form sua sach hop le, kem bia tu tai len. */
function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ title: "Những bữa sáng", mode: "chia-se", cover: "nui-xa", coverMedia: BIA, ...fields })) fd.set(k, v);
  return fd;
}

/** Goi mot action tu chuyen trang khi thanh cong: tra ve dich cua redirect, hoac ket qua loi cua action. */
async function goi<T>(chay: () => Promise<T>): Promise<T | { di: string }> {
  try {
    return await chay();
  } catch (err) {
    if (typeof err === "object" && err !== null && "di" in err) return { di: String(err.di) };
    throw err;
  }
}

/** Ham a chay truoc ham b. */
function truoc(a: { mock: { invocationCallOrder: number[] } }, b: { mock: { invocationCallOrder: number[] } }): boolean {
  return a.mock.invocationCallOrder[0] < b.mock.invocationCallOrder[0];
}

afterEach(() => {
  for (const f of [
    readMe, updateBook, findOwnBook, publishDraft, editRound, deleteUnpublishedBook, discardDraft,
    sweepMediaAfterResponse, redirect, refresh,
  ]) f.mockReset();
  redirect.mockImplementation((to: string) => {
    throw Object.assign(new Error(`redirect:${to}`), { di: to });
  });
});

describe("actionUpdateBook hen don rac media", () => {
  it("sua xong: ghi truoc, hen don sau, roi moi chuyen trang", async () => {
    readMe.mockResolvedValue(ME);
    updateBook.mockResolvedValue("saved");
    expect(await goi(() => actionUpdateBook(BOOK, form()))).toEqual({ di: `/sach/${BOOK}` });
    expect(updateBook).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, BOOK, expect.objectContaining({ coverMediaId: BIA }));
    expect(sweepMediaAfterResponse).toHaveBeenCalledTimes(1);
    expect(truoc(updateBook, sweepMediaAfterResponse)).toBe(true);
    expect(truoc(sweepMediaAfterResponse, redirect)).toBe(true);
  });

  it("chua dang nhap: khong ghi va khong hen don", async () => {
    readMe.mockResolvedValue(null);
    expect(await goi(() => actionUpdateBook(BOOK, form()))).toEqual({ error: CAN_DANG_NHAP });
    expect([updateBook.mock.calls.length, sweepMediaAfterResponse.mock.calls.length]).toEqual([0, 0]);
  });

  it("form sai: khong ghi va khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    expect(await goi(() => actionUpdateBook(BOOK, form({ title: "" })))).toMatchObject({ error: expect.stringContaining("Tên sách") });
    expect([updateBook.mock.calls.length, sweepMediaAfterResponse.mock.calls.length]).toEqual([0, 0]);
  });

  it("cuon khong phai cua minh hay bia khong dung duoc: bao loi, khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    updateBook.mockResolvedValueOnce("not-found").mockResolvedValueOnce("invalid-cover");
    expect(await goi(() => actionUpdateBook(BOOK, form()))).toEqual({ error: KHONG_THAY_SACH });
    expect(await goi(() => actionUpdateBook(BOOK, form()))).toEqual({ error: "Ảnh bìa không dùng được nữa. Chọn lại ảnh bìa." });
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });
});

describe("actionPublish hen don rac media", () => {
  it("dang xong: dang truoc, hen don sau, roi moi chuyen trang", async () => {
    readMe.mockResolvedValue(ME);
    findOwnBook.mockResolvedValue({ id: BOOK, mode: "chia-se" });
    publishDraft.mockResolvedValue({ firstPosition: 3, count: 1 });
    expect(await goi(() => actionPublish(BOOK, [TO]))).toEqual({ di: `/sach/${BOOK}?trang=3` });
    expect(sweepMediaAfterResponse).toHaveBeenCalledTimes(1);
    expect(truoc(publishDraft, sweepMediaAfterResponse)).toBe(true);
    expect(truoc(sweepMediaAfterResponse, redirect)).toBe(true);
  });

  it("chua dang nhap, khong con cuon, hay dang khong duoc: khong hen don", async () => {
    readMe.mockResolvedValue(null);
    expect(await goi(() => actionPublish(BOOK, [TO]))).toEqual({ error: CAN_DANG_NHAP });

    readMe.mockResolvedValue(ME);
    findOwnBook.mockResolvedValueOnce(null);
    expect(await goi(() => actionPublish(BOOK, [TO]))).toMatchObject({ error: expect.stringContaining("Chưa đăng được") });

    findOwnBook.mockResolvedValue({ id: BOOK, mode: "chia-se" });
    publishDraft.mockResolvedValue(null);
    expect(await goi(() => actionPublish(BOOK, [TO]))).toMatchObject({ error: expect.stringContaining("Chưa đăng được") });

    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });

  it("to co noi dung khong doc duoc: tu choi ca lan dang, khong cham database va khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    expect(await goi(() => actionPublish(BOOK, [{ type: "doc", content: "khong phai mang" }]))).toEqual({ error: "Có trang có nội dung không đọc được." });
    expect([findOwnBook.mock.calls.length, publishDraft.mock.calls.length, sweepMediaAfterResponse.mock.calls.length]).toEqual([0, 0, 0]);
  });
});

describe("actionDeleteBook va actionDiscardDraft", () => {
  it("xoa sach: chu la nguoi dang dang nhap (khong nhan tu client), xoa xong hen don rac roi lam moi trang", async () => {
    readMe.mockResolvedValue(ME);
    deleteUnpublishedBook.mockResolvedValue("deleted");
    expect(await actionDeleteBook(BOOK)).toBeUndefined();
    expect(deleteUnpublishedBook).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, BOOK);
    expect(truoc(deleteUnpublishedBook, sweepMediaAfterResponse)).toBe(true);
    expect(truoc(sweepMediaAfterResponse, refresh)).toBe(true);
  });

  it.each([
    ["has-pages", "Cuốn này đã có trang đăng nên không xóa được. Bạn vẫn bỏ được bản nháp."],
    ["not-found", KHONG_THAY_SACH],
  ])("xoa sach tra %s: bao loi, khong don rac, khong lam moi", async (ketQua, loi) => {
    readMe.mockResolvedValue(ME);
    deleteUnpublishedBook.mockResolvedValue(ketQua);
    expect(await actionDeleteBook(BOOK)).toEqual({ error: loi });
    expect([sweepMediaAfterResponse.mock.calls.length, refresh.mock.calls.length]).toEqual([0, 0]);
  });

  it("bo ban nhap: xong thi hen don rac va lam moi; khong co ban nhap thi bao loi", async () => {
    readMe.mockResolvedValue(ME);
    discardDraft.mockResolvedValueOnce("discarded").mockResolvedValueOnce("not-found");
    expect(await actionDiscardDraft(BOOK)).toBeUndefined();
    expect(discardDraft).toHaveBeenCalledWith({ la: "db-gia" }, ME.accountId, BOOK);
    expect([sweepMediaAfterResponse.mock.calls.length, refresh.mock.calls.length]).toEqual([1, 1]);
    expect(await actionDiscardDraft(BOOK)).toEqual({ error: "Không tìm thấy bản nháp này." });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("chua dang nhap: khong cham database", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionDeleteBook(BOOK)).toEqual({ error: CAN_DANG_NHAP });
    expect(await actionDiscardDraft(BOOK)).toEqual({ error: CAN_DANG_NHAP });
    expect([deleteUnpublishedBook.mock.calls.length, discardDraft.mock.calls.length]).toEqual([0, 0]);
  });
});

describe("actionEditRound", () => {
  const BASE = "2026-09-19T07:05:00.000Z";
  const LUOT = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";
  const KHONG_THAY_LUOT = "Không tìm thấy lượt này.";
  const chu = (n: number) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(n) }] }] });

  it("chua dang nhap: khong goi editRound", async () => {
    readMe.mockResolvedValue(null);
    expect(await goi(() => actionEditRound(BOOK, LUOT, [TO], BASE))).toEqual({ error: CAN_DANG_NHAP });
    expect(editRound).not.toHaveBeenCalled();
  });

  it.each<[string, unknown, unknown]>([
    ["ma luot rac", "rac", BASE],
    ["ma luot la so", 1, BASE],
    ["ma luot null", null, BASE],
    ["moc la so", LUOT, 123],
    ["moc khong doc duoc", LUOT, "hom qua"],
    ["moc rong", LUOT, ""],
    // Moc doc duoc va dung thoi diem cua BASE, chi dai hon 40 ky tu: bi tu choi vi do dai chu khong vi khong doc duoc.
    ["moc dai hon 40 ky tu", LUOT, "Sat Sep 19 2026 07:05:00 GMT+0000 (Coordinated Universal Time)"],
  ])("%s: khong tim thay luot, khong goi editRound", async (_ten, luot, moc) => {
    readMe.mockResolvedValue(ME);
    expect(await goi(() => actionEditRound(BOOK, luot, [TO], moc))).toEqual({ error: KHONG_THAY_LUOT });
    expect(editRound).not.toHaveBeenCalled();
  });

  it("mang to sai, to hong, qua tran chu cua luot: bao dung cau, khong goi editRound", async () => {
    readMe.mockResolvedValue(ME);
    const soTo = "Mỗi lượt có từ 1 tới 40 trang.";
    expect(await goi(() => actionEditRound(BOOK, LUOT, "khong phai mang", BASE))).toEqual({ error: soTo });
    expect(await goi(() => actionEditRound(BOOK, LUOT, [], BASE))).toEqual({ error: soTo });
    expect(await goi(() => actionEditRound(BOOK, LUOT, Array.from({ length: 41 }, () => TO), BASE))).toEqual({ error: soTo });
    expect(await goi(() => actionEditRound(BOOK, LUOT, [{ type: "x" }], BASE))).toEqual({ error: "Có trang có nội dung không đọc được." });
    expect(await goi(() => actionEditRound(BOOK, LUOT, [chu(DOC_LIMITS.maxChars), chu(1)], BASE))).toEqual({ error: "Lượt dài quá 20 000 ký tự." });
    expect(editRound).not.toHaveBeenCalled();
  });

  it.each<[string, string]>([
    ["not-found", KHONG_THAY_LUOT],
    ["sealed", "Lượt này đang niêm phong nên chưa sửa được."],
    ["stale", LUOT_VUA_SUA_NOI_KHAC],
    ["invalid-media", "Có ảnh hoặc ghi âm không dùng được trong lượt này."],
    ["invalid", "Lượt phải còn ít nhất một trang không trống."],
  ])("editRound tra %s: bao dung cau, khong hen don, khong chuyen trang", async (ketQua, cau) => {
    readMe.mockResolvedValue(ME);
    editRound.mockResolvedValue(ketQua);
    expect(await goi(() => actionEditRound(BOOK, LUOT, [TO], BASE))).toEqual({ error: cau });
    expect([sweepMediaAfterResponse.mock.calls.length, redirect.mock.calls.length]).toEqual([0, 0]);
  });

  it("saved: hen don rac dung mot lan, truoc khi ve to dau cua luot", async () => {
    readMe.mockResolvedValue(ME);
    editRound.mockResolvedValue({ status: "saved", first: 6 });
    expect(await goi(() => actionEditRound(BOOK, LUOT, [TO], BASE))).toEqual({ di: `/sach/${BOOK}?trang=6` });
    expect(sweepMediaAfterResponse).toHaveBeenCalledTimes(1);
    expect(truoc(editRound, sweepMediaAfterResponse)).toBe(true);
    expect(truoc(sweepMediaAfterResponse, redirect)).toBe(true);
  });

  it("unchanged: ve cung dich, khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    editRound.mockResolvedValue({ status: "unchanged", first: 6 });
    expect(await goi(() => actionEditRound(BOOK, LUOT, [TO], BASE))).toEqual({ di: `/sach/${BOOK}?trang=6` });
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });

  it("editRound nhan db, nguoi dang nhap, sach, luot, cac to da qua kiem va moc dang Date", async () => {
    readMe.mockResolvedValue(ME);
    editRound.mockResolvedValue({ status: "saved", first: 1 });
    // Truong la bi cleanDoc bo: editRound chi thay ban da qua kiem.
    const coRac = { ...TO, content: [{ ...TO.content[0], rac: 1 }] };
    await goi(() => actionEditRound(BOOK, LUOT, [coRac, TO], BASE));
    const [dbGoi, ai, sach, luot, cacTo, moc] = editRound.mock.calls[0];
    expect([dbGoi, ai, sach, luot, cacTo]).toEqual([{ la: "db-gia" }, ME.accountId, BOOK, LUOT, [TO, TO]]);
    expect((moc as Date).getTime()).toBe(new Date(BASE).getTime());
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { actionDeleteBook, actionDiscardDraft, actionPublish, actionUpdateBook } from "@/app/actions/library";
import { CAN_DANG_NHAP, KHONG_THAY_SACH } from "@/app/actions/messages";

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
  readMe, updateBook, findOwnBook, publishDraft, deleteUnpublishedBook, discardDraft,
  sweepMediaAfterResponse, redirect, refresh,
} = vi.hoisted(() => ({
  readMe: vi.fn(),
  updateBook: vi.fn(),
  findOwnBook: vi.fn(),
  publishDraft: vi.fn(),
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
vi.mock("@/server/library/drafts", () => ({ MAX_SHEETS_PER_PUBLISH: 40, publishDraft, saveDraft: vi.fn() }));
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
    readMe, updateBook, findOwnBook, publishDraft, deleteUnpublishedBook, discardDraft,
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

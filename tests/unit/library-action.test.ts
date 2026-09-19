import { afterEach, describe, expect, it, vi } from "vitest";
import { actionEditPage, actionPublish, actionUpdateBook } from "@/app/actions/library";
import { CAN_DANG_NHAP, KHONG_THAY_SACH } from "@/app/actions/messages";
import { EDIT_SHEET_MAX_CHARS } from "@/lib/doc/validate";

/*
 * Hai day noi cua don rac media o src/app/actions/library.ts: sua sach xong va dang trang xong deu phai hen
 * sweepMediaAfterResponse. Hai cho goi do truoc day khong co test nao chay qua - book-form.test.tsx va
 * publish-bar.test.tsx deu vi.mock ca mo dun action, nen than cua action khong bao gio chay va xoa han mot trong hai
 * dong cung khong lam do test nao. Thieu don rac thi nguoi chi doi bia ma khong tai gi them se tich rac mai mai.
 *
 * Nhu media-action.test.ts: mo dun that (guard, books, drafts, kho, don rac) deu la ham gia, o day chi kiem THU TU -
 * ghi thanh cong truoc, roi moi hen don - va kiem rang moi duong that bai khong hen don.
 */

const { readMe, updateBook, findOwnBook, publishDraft, editPage, sweepMediaAfterResponse, redirect } = vi.hoisted(() => ({
  readMe: vi.fn(),
  editPage: vi.fn(),
  updateBook: vi.fn(),
  findOwnBook: vi.fn(),
  publishDraft: vi.fn(),
  sweepMediaAfterResponse: vi.fn(),
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
vi.mock("@/server/library/edit-page", () => ({ editPage }));
vi.mock("@/server/web/media-sweep", () => ({ sweepMediaAfterResponse }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));
vi.mock("next/navigation", () => ({ redirect }));

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
  for (const f of [readMe, updateBook, findOwnBook, publishDraft, editPage, sweepMediaAfterResponse, redirect]) f.mockReset();
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

describe("actionEditPage", () => {
  const BASE = "2026-09-19T07:05:00.000Z";
  const KHONG_THAY_TRANG = "Không tìm thấy trang này.";
  const TRANG_DAI = "Trang dài quá một trang.";
  const chu = (n: number) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(n) }] }] });

  it("chua dang nhap: khong goi editPage", async () => {
    readMe.mockResolvedValue(null);
    expect(await goi(() => actionEditPage(BOOK, 2, TO, BASE))).toEqual({ error: CAN_DANG_NHAP });
    expect(editPage).not.toHaveBeenCalled();
  });

  it.each<[string, unknown, unknown]>([
    ["vi tri 0", 0, BASE],
    ["vi tri 100 000", 100_000, BASE],
    ["vi tri 1.5", 1.5, BASE],
    ["vi tri la chuoi", "2", BASE],
    ["vi tri null", null, BASE],
    ["moc la so", 2, 123],
    ["moc khong doc duoc", 2, "hom qua"],
    ["moc rong", 2, ""],
    ["moc 41 ky tu", 2, `${BASE}${"0".repeat(41 - BASE.length)}`],
  ])("%s: khong tim thay trang, khong goi editPage", async (_ten, viTri, moc) => {
    readMe.mockResolvedValue(ME);
    expect(await goi(() => actionEditPage(BOOK, viTri, TO, moc))).toEqual({ error: KHONG_THAY_TRANG });
    expect(editPage).not.toHaveBeenCalled();
  });

  it("tai lieu hong, qua DOC_LIMITS, qua tran mot to, hay trong: bao dung cau, khong goi editPage", async () => {
    readMe.mockResolvedValue(ME);
    expect(await goi(() => actionEditPage(BOOK, 2, { type: "x" }, BASE))).toEqual({ error: "Trang có nội dung không đọc được." });
    expect(await goi(() => actionEditPage(BOOK, 2, chu(20_001), BASE))).toEqual({ error: TRANG_DAI });
    expect(await goi(() => actionEditPage(BOOK, 2, chu(EDIT_SHEET_MAX_CHARS + 1), BASE))).toEqual({ error: TRANG_DAI });
    expect(await goi(() => actionEditPage(BOOK, 2, { type: "doc", content: [{ type: "paragraph" }] }, BASE))).toEqual({ error: "Trang không được để trống." });
    expect(editPage).not.toHaveBeenCalled();
  });

  it("dung bang tran mot to: qua toi editPage", async () => {
    readMe.mockResolvedValue(ME);
    editPage.mockResolvedValue("unchanged");
    expect(await goi(() => actionEditPage(BOOK, 2, chu(EDIT_SHEET_MAX_CHARS), BASE))).toEqual({ di: `/sach/${BOOK}?trang=2` });
    expect(editPage).toHaveBeenCalledTimes(1);
  });

  it.each<[string, string]>([
    ["not-found", KHONG_THAY_TRANG],
    ["sealed", "Trang niêm phong không sửa được."],
    ["stale", "Trang này vừa được sửa ở nơi khác. Tải lại để xem bản mới."],
    ["invalid-media", "Có ảnh hoặc ghi âm không dùng được trên trang này."],
  ])("editPage tra %s: bao dung cau, khong hen don, khong chuyen trang", async (ketQua, cau) => {
    readMe.mockResolvedValue(ME);
    editPage.mockResolvedValue(ketQua);
    expect(await goi(() => actionEditPage(BOOK, 2, TO, BASE))).toEqual({ error: cau });
    expect([sweepMediaAfterResponse.mock.calls.length, redirect.mock.calls.length]).toEqual([0, 0]);
  });

  it("saved: hen don rac dung mot lan, truoc khi ve dung to vua sua", async () => {
    readMe.mockResolvedValue(ME);
    editPage.mockResolvedValue("saved");
    expect(await goi(() => actionEditPage(BOOK, 2, TO, BASE))).toEqual({ di: `/sach/${BOOK}?trang=2` });
    expect(sweepMediaAfterResponse).toHaveBeenCalledTimes(1);
    expect(truoc(editPage, sweepMediaAfterResponse)).toBe(true);
    expect(truoc(sweepMediaAfterResponse, redirect)).toBe(true);
  });

  it("unchanged: ve cung dich, khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    editPage.mockResolvedValue("unchanged");
    expect(await goi(() => actionEditPage(BOOK, 2, TO, BASE))).toEqual({ di: `/sach/${BOOK}?trang=2` });
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });

  it("editPage nhan db, nguoi dang nhap, vi tri so, tai lieu da qua kiem va moc dang Date", async () => {
    readMe.mockResolvedValue(ME);
    editPage.mockResolvedValue("saved");
    // Truong la bi checkDraftInput bo: editPage chi thay ban da qua kiem.
    const coRac = { ...TO, content: [{ ...TO.content[0], rac: 1 }] };
    await goi(() => actionEditPage(BOOK, 2, coRac, BASE));
    const [dbGoi, ai, sach, viTri, doc, moc] = editPage.mock.calls[0];
    expect([dbGoi, ai, sach, viTri, doc]).toEqual([{ la: "db-gia" }, ME.accountId, BOOK, 2, TO]);
    expect((moc as Date).getTime()).toBe(new Date(BASE).getTime());
  });

  it("chi giu dau noi tiep o muc dau cua danh sach dau truoc khi toi editPage", async () => {
    readMe.mockResolvedValue(ME);
    editPage.mockResolvedValue("saved");
    const muc = (text: string, noiTiep: boolean) => ({
      type: "listItem", ...(noiTiep ? { noiTiep: true } : {}), content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const guiLen = { type: "doc", content: [{ type: "bulletList", content: [muc("một", true), muc("hai", true)] }] };
    await goi(() => actionEditPage(BOOK, 2, guiLen, BASE));
    expect(editPage.mock.calls[0][4]).toEqual({ type: "doc", content: [{ type: "bulletList", content: [muc("một", true), muc("hai", false)] }] });
  });
});

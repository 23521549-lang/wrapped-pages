"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { createBook, findOwnBook, updateBook } from "@/server/library/books";
import { MAX_SHEETS_PER_PUBLISH, publishDraft, saveDraft } from "@/server/library/drafts";
import { editPage, type EditResult } from "@/server/library/edit-page";
import { markRead } from "@/server/library/pages";
import { readMe } from "@/server/web/guard";
import { sweepMediaAfterResponse } from "@/server/web/media-sweep";
import { parseBookInput } from "@/lib/book";
import { docCharCount, isBlankDoc } from "@/lib/doc/text";
import { checkDraftInput, checkPublishInput, DOC_LIMITS, EDIT_SHEET_MAX_CHARS, PUBLISH_TOTAL_MAX_CHARS } from "@/lib/doc/validate";
import { parseSealInput } from "@/lib/seal/input";
import { CAN_DANG_NHAP, KHONG_THAY_SACH } from "./messages";

const NHAP_KHONG_DOC_DUOC = "Bản nháp có nội dung không đọc được.";
const BIA_KHONG_DUNG_DUOC = "Ảnh bìa không dùng được nữa. Chọn lại ảnh bìa.";
const KHONG_THAY_TRANG = "Không tìm thấy trang này.";
const TRANG_DAI = "Trang dài quá một trang.";
const LOI_SUA: Record<Exclude<EditResult, "saved" | "unchanged">, string> = {
  "not-found": KHONG_THAY_TRANG,
  sealed: "Trang niêm phong không sửa được.",
  stale: "Trang này vừa được sửa ở nơi khác. Tải lại để xem bản mới.",
  "invalid-media": "Có ảnh hoặc ghi âm không dùng được trên trang này.",
};

/** Tao cuon moi cho nguoi dang dang nhap, roi mo man viet cua cuon do. Bia tu tai len khong dung duoc thi bao loi. */
export async function actionCreateBook(formData: FormData) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const input = parseBookInput(formData);
  if ("error" in input) return input;
  const id = await createBook(db, me.accountId, input);
  if (!id) return { error: BIA_KHONG_DUNG_DUOC };
  redirect(`/sach/${id}/viet`);
}

/**
 * Doi ten, che do hoac bia. Chi chu sach sua duoc; cuon cua nguoi khac tra loi nhu cuon khong ton tai. Sua xong hen don
 * rac media sau phan hoi, vi bia vua bi thay thanh rac.
 */
export async function actionUpdateBook(bookId: string, formData: FormData) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const input = parseBookInput(formData);
  if ("error" in input) return input;
  const result = await updateBook(db, me.accountId, bookId, input);
  if (result === "not-found") return { error: KHONG_THAY_SACH };
  if (result === "invalid-cover") return { error: BIA_KHONG_DUNG_DUOC };
  sweepMediaAfterResponse();
  redirect(`/sach/${bookId}`);
}

/**
 * Day moc da doc cua nguoi dang dang nhap. Moi luat (khong lui, khong vuot to cuoi, bo qua sach cua minh
 * va sach khong duoc doc) nam o markRead. Khong goi refresh(): lam vay thi moi lan danh dau, man doc bi
 * render lai va gui lai toan bo cac to.
 */
export async function actionMarkRead(bookId: string, position: number) {
  const me = await readMe();
  if (!me) return;
  await markRead(db, me.accountId, bookId, position);
}

/**
 * Luu ban nhap cua man viet. doc den tu trinh duyet nen phai qua checkDraftInput truoc khi cham
 * database: chi cau truc no chap nhan moi duoc luu, moi thu khac bi tu choi ngay tai day.
 * Khong goi refresh(): lam moi cay may chu giua luc dang go la vo ich va de lam nhay con tro.
 *
 * checkDraftInput kiem do dai TRUOC cleanDoc va tra ve ly do rieng cho tung truong hop:
 * khong lam vay thi vuot tran do dai bi tra ve null giong het loi cau truc, nguoi dung cham tran se
 * khong bao gio biet vi sao va nut Thu lai khong bao gio thanh cong duoc.
 * Khoi media muon id bi saveDraft tu choi (bindMedia) va bao cung thong diep noi dung khong doc duoc.
 */
export async function actionSaveDraft(bookId: string, doc: unknown, sheetCount: number) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const checked = checkDraftInput(doc);
  if (!checked.ok) {
    if (checked.reason === "too-long") {
      const vuot = checked.chars - DOC_LIMITS.maxChars;
      return {
        error: `Bản nháp đã vượt quá ${DOC_LIMITS.maxChars.toLocaleString("vi-VN")} chữ (dư khoảng ${vuot.toLocaleString("vi-VN")} chữ). Đăng bớt trang đi rồi viết tiếp.`,
      };
    }
    return { error: NHAP_KHONG_DOC_DUOC };
  }
  const saved = await saveDraft(db, me.accountId, bookId, checked.doc, sheetCount);
  if (saved === "not-found") return { error: KHONG_THAY_SACH };
  if (saved === "invalid-media") return { error: NHAP_KHONG_DOC_DUOC };
  return { savedAt: saved.toISOString() };
}

/**
 * checkPublishInput cong tong ky tu ca mang va tu choi khi vuot PUBLISH_TOTAL_MAX_CHARS: moi
 * to rieng duoc phep toi DOC_LIMITS.maxChars, nhung actionPublish la diem cuoi cong khai - ai cung goi
 * duoc voi bat ky mang to nao, khong bat buoc phai di qua man viet that su cat nho tu mot ban nhap hop
 * le ra. Khong co tran tong thi mot lan goi mang toi 40 to x 20 000 chu rieng vao duoc bang pages.
 *
 * Dang cac to da cat san (man viet gui len) thanh trang that, kem niem phong neu co. sheets va seal den tu
 * trinh duyet nen deu qua ham kiem thuan truoc khi cham database: checkPublishInput cho cac to (ca tran tong
 * ky tu), parseSealInput cho niem phong. Mot phan bat ky loi la tu choi ca lan dang, khong dang mot phan.
 * Che do sach doc o day de kiem niem phong som va bao loi ro; publishDraft kiem lai trong giao dich, cung voi
 * moi khoi media cua tung to (bindMedia). Dang xong hen don rac media sau phan hoi.
 */
export async function actionPublish(bookId: string, sheets: unknown, seal: unknown = null) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if (!Array.isArray(sheets) || sheets.length === 0 || sheets.length > MAX_SHEETS_PER_PUBLISH) {
    return { error: `Mỗi lần đăng được từ 1 tới ${MAX_SHEETS_PER_PUBLISH} trang.` };
  }
  const checked = checkPublishInput(sheets);
  if (!checked.ok) {
    if (checked.reason === "too-long") {
      return { error: `Tổng số chữ của các trang vượt quá ${PUBLISH_TOTAL_MAX_CHARS.toLocaleString("vi-VN")}. Đăng thành nhiều lần thay vì một lần.` };
    }
    return { error: "Có trang có nội dung không đọc được." };
  }
  const book = await findOwnBook(db, me.accountId, bookId);
  if (!book) return { error: "Chưa đăng được. Trang còn trống hoặc cuốn sách không còn." };
  const parsed = parseSealInput(seal, book.mode, new Date());
  if (!parsed.ok) return { error: parsed.error };
  const r = await publishDraft(db, me.accountId, bookId, checked.sheets, parsed.seal);
  if (!r) return { error: "Chưa đăng được. Trang còn trống hoặc cuốn sách không còn." };
  sweepMediaAfterResponse();
  redirect(`/sach/${bookId}?trang=${r.firstPosition}`);
}

/**
 * Chu sach luu mot to da dang vua sua. Moi phep kiem re (vi tri, moc, cau truc, tran chu cua mot to, to trong) dat
 * truoc khi cham database. Quyen nam trong giao dich cua editPage: nguoi kia goi thang voi dung bookId va vi tri cua
 * mot sach chia se nhan cung cau voi sach la, vi tri la, va khong co gi duoc ghi. CSRF do server action cua Next lo
 * (chi nhan POST mang Next-Action, so Origin voi Host, cookie phien SameSite=Lax), khong them allowedOrigins.
 * Luu xong hen don rac media, vi media bi bo khoi to thanh rac; khong doi gi thi chi ve lai man doc.
 */
export async function actionEditPage(bookId: string, position: unknown, doc: unknown, base: unknown) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1 || position > 99_999) return { error: KHONG_THAY_TRANG };
  if (typeof base !== "string" || base.length > 40 || Number.isNaN(new Date(base).getTime())) return { error: KHONG_THAY_TRANG };
  const checked = checkDraftInput(doc);
  if (!checked.ok) return { error: checked.reason === "too-long" ? TRANG_DAI : "Trang có nội dung không đọc được." };
  if (docCharCount(checked.doc) > EDIT_SHEET_MAX_CHARS) return { error: TRANG_DAI };
  if (isBlankDoc(checked.doc)) return { error: "Trang không được để trống." };
  const r = await editPage(db, me.accountId, bookId, position, checked.doc, new Date(base));
  if (r !== "saved" && r !== "unchanged") return { error: LOI_SUA[r] };
  if (r === "saved") sweepMediaAfterResponse();
  redirect(`/sach/${bookId}?trang=${position}`);
}

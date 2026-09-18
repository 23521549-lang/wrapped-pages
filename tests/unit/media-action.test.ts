import { afterEach, describe, expect, it, vi } from "vitest";
import { actionUploadMedia } from "@/app/actions/media";
import { CAN_DANG_NHAP, CHUA_BAT_KHO_MEDIA, KHONG_THAY_SACH } from "@/app/actions/messages";
import { PEAK_COUNT } from "@/lib/media/kinds";
import { UPLOAD_ERRORS } from "@/lib/media/upload";
import { isUuid } from "@/lib/uuid";

/*
 * Action tai len tren ham gia: guard that can cookie cua request; saveUpload, kho va don rac that da duoc
 * media-sweep.test.ts kiem tren PGlite. O day chi kiem thu tu: nguoi dang nhap, kho, form, ghi, roi moi hen don.
 */

const { readMe, getMediaStore, saveUpload, sweepMediaAfterResponse } = vi.hoisted(() => ({
  readMe: vi.fn(),
  getMediaStore: vi.fn(),
  saveUpload: vi.fn(),
  sweepMediaAfterResponse: vi.fn(),
}));
vi.mock("@/server/web/guard", () => ({ readMe }));
vi.mock("@/server/media/get-store", () => ({ getMediaStore }));
vi.mock("@/server/media/save-upload", () => ({ saveUpload }));
vi.mock("@/server/web/media-sweep", () => ({ sweepMediaAfterResponse }));
vi.mock("@/server/db", () => ({ db: { la: "db-gia" } }));

const ME = { accountId: "tai-khoan-1", seat: 1, nickname: "Linh", partnerNickname: "Manh" };
const KHO = { la: "kho-gia" };
const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const SONG = Array.from({ length: PEAK_COUNT }, () => 7);

/** WebP VP8X 1200 x 900, 30 byte. */
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00,
  0x10, 0x00, 0x00, 0x00, 0xaf, 0x04, 0x00, 0x83, 0x03, 0x00,
]);
/** Header EBML chi co DocType webm. */
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);

function form(fields: Record<string, string>, file: Uint8Array<ArrayBuffer>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  fd.set("file", new File([file], "tep"));
  return fd;
}

afterEach(() => {
  readMe.mockReset();
  getMediaStore.mockReset();
  saveUpload.mockReset();
  sweepMediaAfterResponse.mockReset();
});

describe("actionUploadMedia", () => {
  it("chua dang nhap: bao can dang nhap, khong cham kho, khong ghi, khong hen don", async () => {
    readMe.mockResolvedValue(null);
    expect(await actionUploadMedia(form({ kind: "anh", book: BOOK }, WEBP))).toEqual({ error: CAN_DANG_NHAP });
    expect(getMediaStore).not.toHaveBeenCalled();
    expect(saveUpload).not.toHaveBeenCalled();
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });

  it("kho tat: bao em chua bat kho, khong ghi, khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    getMediaStore.mockReturnValue(null);
    expect(await actionUploadMedia(form({ kind: "anh", book: BOOK }, WEBP))).toEqual({ error: CHUA_BAT_KHO_MEDIA });
    expect(saveUpload).not.toHaveBeenCalled();
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });

  it("form sai (am thanh gui duoi dang anh): tra loi cua parseUploadForm, khong ghi", async () => {
    readMe.mockResolvedValue(ME);
    getMediaStore.mockReturnValue(KHO);
    expect(await actionUploadMedia(form({ kind: "anh", book: BOOK }, WEBM))).toEqual({ error: UPLOAD_ERRORS.invalid });
    expect(saveUpload).not.toHaveBeenCalled();
  });

  it("anh hop le: ghi cho dung nguoi dang nhap voi kich thuoc that, ghi xong moi hen don, tra id va kich thuoc", async () => {
    readMe.mockResolvedValue(ME);
    getMediaStore.mockReturnValue(KHO);
    saveUpload.mockResolvedValue("saved");
    const res = await actionUploadMedia(form({ kind: "anh", book: BOOK, w: "1", h: "1" }, WEBP));
    const [db, kho, record, body] = saveUpload.mock.calls[0];
    expect([db, kho]).toEqual([{ la: "db-gia" }, KHO]);
    expect(record).toEqual({ id: record.id, ownerId: ME.accountId, kind: "anh", bookId: BOOK, mime: "image/webp", bytes: 30, width: 1200, height: 900 });
    expect(isUuid(record.id)).toBe(true);
    expect(body).toEqual(WEBP);
    expect(res).toEqual({ id: record.id, w: 1200, h: 900 });
    expect(saveUpload.mock.invocationCallOrder[0]).toBeLessThan(sweepMediaAfterResponse.mock.invocationCallOrder[0]);
  });

  it("ghi am hop le: tra id, thoi luong va song am da kiem", async () => {
    readMe.mockResolvedValue(ME);
    getMediaStore.mockReturnValue(KHO);
    saveUpload.mockResolvedValue("saved");
    const res = await actionUploadMedia(form({ kind: "ghi-am", book: BOOK, ms: "42000", peaks: JSON.stringify(SONG) }, WEBM));
    const record = saveUpload.mock.calls[0][2];
    expect(record).toMatchObject({ kind: "ghi-am", bookId: BOOK, mime: "audio/webm", durationMs: 42_000, peaks: SONG });
    expect(res).toEqual({ id: record.id, ms: 42_000, peaks: SONG });
  });

  it("cuon khong phai cua minh (saveUpload tra not-found): bao khong tim thay sach, khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    getMediaStore.mockReturnValue(KHO);
    saveUpload.mockResolvedValue("not-found");
    expect(await actionUploadMedia(form({ kind: "anh", book: BOOK }, WEBP))).toEqual({ error: KHONG_THAY_SACH });
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });

  it("kho gan day (saveUpload tra full): bao kho gan day, khong hen don", async () => {
    readMe.mockResolvedValue(ME);
    getMediaStore.mockReturnValue(KHO);
    saveUpload.mockResolvedValue("full");
    expect(await actionUploadMedia(form({ kind: "anh", book: BOOK }, WEBP))).toEqual({ error: UPLOAD_ERRORS.full });
    expect(sweepMediaAfterResponse).not.toHaveBeenCalled();
  });
});

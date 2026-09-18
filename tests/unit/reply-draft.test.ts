import { describe, expect, it } from "vitest";
import {
  checkReply,
  keptText,
  readReplyDraft,
  REPLY_DRAFT_PREFIX,
  REPLY_ERRORS,
  replyDraftKey,
} from "@/components/editor/replyDraft";
import { DOC_LIMITS } from "@/lib/doc/validate";
import { SEAL_LIMITS } from "@/lib/seal/types";

function doan(text: string) {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

describe("checkReply: kiem trang tra loi dung nhu actionSubmitReply va submitReply", () => {
  it("co chu va vua tran thi gui duoc, tra ban da qua cleanDoc", () => {
    expect(checkReply(doan("Em nghĩ về anh"))).toEqual({ ok: true, doc: doan("Em nghĩ về anh") });
  });

  it("doan trong va doan chi co khoang trang la trong", () => {
    expect(checkReply({ type: "doc", content: [{ type: "paragraph" }] })).toEqual({ ok: false, reason: "blank" });
    expect(checkReply(doan("   "))).toEqual({ ok: false, reason: "blank" });
  });

  it("chu chi gom ky tu cleanDoc bo di (NUL, nua cap surrogate le) cung la trong, nhu tren may chu", () => {
    expect(checkReply(doan(String.fromCharCode(0, 0xd800)))).toEqual({ ok: false, reason: "blank" });
  });

  it("dem ky tu theo don vi UTF-16 nhu docCharCount: dung tran thi duoc, qua mot la qua nhieu", () => {
    expect(checkReply(doan("a".repeat(SEAL_LIMITS.replyMaxChars))).ok).toBe(true);
    expect(checkReply(doan("a".repeat(SEAL_LIMITS.replyMaxChars + 1)))).toEqual({ ok: false, reason: "too-many-chars" });
    // Moi bieu tuong ngoai BMP la hai don vi: 751 hinh la 1502 don vi, qua tran du chi vua mot to.
    expect(checkReply(doan(String.fromCodePoint(0x1f600).repeat(751)))).toEqual({ ok: false, reason: "too-many-chars" });
  });

  it("qua tran chung cua moi tai lieu la too-long, cau truc la la invalid", () => {
    expect(checkReply(doan("a".repeat(DOC_LIMITS.maxChars + 1)))).toEqual({ ok: false, reason: "too-long" });
    expect(checkReply({ type: "doc", content: [{ type: "heading", content: [] }] })).toEqual({ ok: false, reason: "invalid" });
    expect(checkReply(null)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("thong diep loi cua man tra loi", () => {
  it("moi loi tru trang trong deu noi chu van con o day", () => {
    for (const [ly, chu] of Object.entries(REPLY_ERRORS)) {
      if (ly === "blank") expect(chu).not.toContain("Chữ vẫn còn ở đây.");
      else expect(chu, ly).toMatch(/Chữ vẫn còn ở đây[.]$/);
    }
    expect(keptText("Chưa gửi được trang trả lời.")).toBe("Chưa gửi được trang trả lời. Chữ vẫn còn ở đây.");
  });

  it("khong co gach ngang dai", () => {
    expect(Object.values(REPLY_ERRORS).join(" ")).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("ban luu tam trong sessionStorage", () => {
  it("khoa rieng cho tung niem phong, cung mot tien to", () => {
    expect(REPLY_DRAFT_PREFIX).toBe("mqce-tra-loi-");
    expect(replyDraftKey("abc")).toBe("mqce-tra-loi-abc");
  });

  it("doc lai tai lieu; chuoi hong hay gia tri khong phai tai lieu thi null", () => {
    const d = doan("Em nghĩ về anh");
    expect(readReplyDraft(JSON.stringify(d))).toEqual(d);
    expect(readReplyDraft(null)).toBeNull();
    expect(readReplyDraft("{hong")).toBeNull();
    expect(readReplyDraft("[1]")).toBeNull();
    expect(readReplyDraft("null")).toBeNull();
    expect(readReplyDraft(JSON.stringify({ type: "paragraph" }))).toBeNull();
  });
});

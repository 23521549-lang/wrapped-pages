import { describe, it, expect } from "vitest";
import { checkReply } from "@/components/editor/replyDraft";
import { docCharCount, docExcerpt, docText, hasMediaBlock, isBlankDoc, roughCharCount, trimTrailingBlank } from "@/lib/doc/text";
import type { DocJson, ParagraphNode } from "@/lib/doc/types";
import { checkDraftInput, checkPublishInput, checkReplyInput, cleanDoc, DOC_LIMITS } from "@/lib/doc/validate";
import { AUDIO_MAX_MS, IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX, PEAK_COUNT, PEAK_MAX } from "@/lib/media/kinds";
import type { AudioNode, ImageNode } from "@/lib/media/node";
import { sealTeaser } from "@/lib/seal/teaser";

const LF = String.fromCharCode(10);
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const SONG = Array.from({ length: PEAK_COUNT }, (_, i) => i % (PEAK_MAX + 1));
const ANH: ImageNode = { type: "anh", attrs: { id: ID, w: 1200, h: 900 } };
const GHI_AM: AudioNode = { type: "ghi-am", attrs: { id: ID, ms: 42_000, peaks: SONG } };

const doan = (text: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const tai = (...content: DocJson["content"]): DocJson => ({ type: "doc", content });
/** Tai lieu co dung n khoi media xen giua cac doan chu, xen ke anh va ghi am. */
const nhieuMedia = (n: number): DocJson => tai(...Array.from({ length: n }, (_, i) => [doan("chữ"), i % 2 === 0 ? ANH : GHI_AM]).flat());
/** Tai lieu co mot doan chu roi mot khoi viet tu do, de thu dau vao sai. */
const sau = (block: unknown) => ({ type: "doc", content: [doan("chữ"), block] });

describe("cleanDoc: khoi media o cap cao nhat", () => {
  it("nhan anh va ghi am xen giua cac khoi chu, giu nguyen thu tu", () => {
    const doc = tai(doan("Mở đầu"), ANH, { type: "paragraph" }, GHI_AM, doan("Kết"));
    expect(cleanDoc(doc)).toEqual(doc);
  });

  it("nhan dung tai cac tran: anh lon nhat, anh 1x1, ghi am 1 ms va dai nhat, song toan 0 va toan PEAK_MAX", () => {
    const docs = [
      tai({ type: "anh", attrs: { id: ID, w: IMAGE_MAX_WIDTH_PX, h: IMAGE_MAX_HEIGHT_PX } }),
      tai({ type: "anh", attrs: { id: ID, w: 1, h: 1 } }),
      tai({ type: "ghi-am", attrs: { id: ID, ms: 1, peaks: SONG.map(() => 0) } }),
      tai({ type: "ghi-am", attrs: { id: ID, ms: AUDIO_MAX_MS, peaks: SONG.map(() => PEAK_MAX) } }),
    ];
    for (const doc of docs) expect(cleanDoc(doc)).toEqual(doc);
  });

  it("tra ban sao: sua song am cua dau vao sau khi kiem khong doi tai lieu da kiem", () => {
    const peaks = [...SONG];
    const clean = cleanDoc(tai({ type: "ghi-am", attrs: { id: ID, ms: 1, peaks } }));
    peaks[0] = PEAK_MAX;
    expect(clean).toEqual(tai({ type: "ghi-am", attrs: { id: ID, ms: 1, peaks: SONG } }));
  });

  it.each<[string, unknown]>([
    ["anh thieu attrs", { type: "anh" }],
    ["attrs la null", { type: "anh", attrs: null }],
    ["attrs la mang", { type: "anh", attrs: [ID, 1, 1] }],
    ["anh thieu h", { type: "anh", attrs: { id: ID, w: 1 } }],
    ["anh thua thuoc tinh src", { type: "anh", attrs: { ...ANH.attrs, src: "https://ngoai.example/anh.webp" } }],
    ["anh mang thuoc tinh cua ghi am", { type: "anh", attrs: GHI_AM.attrs }],
    ["khoi co them content", { ...ANH, content: [] }],
    ["khoi co them marks", { ...ANH, marks: [] }],
    ["id khong phai uuid", { type: "anh", attrs: { ...ANH.attrs, id: "anh-cua-em" } }],
    ["id la so", { type: "anh", attrs: { ...ANH.attrs, id: 7 } }],
    ["rong 0", { type: "anh", attrs: { ...ANH.attrs, w: 0 } }],
    ["rong vuot tran", { type: "anh", attrs: { ...ANH.attrs, w: IMAGE_MAX_WIDTH_PX + 1 } }],
    ["cao vuot tran", { type: "anh", attrs: { ...ANH.attrs, h: IMAGE_MAX_HEIGHT_PX + 1 } }],
    ["rong le", { type: "anh", attrs: { ...ANH.attrs, w: 10.5 } }],
    ["cao la chuoi", { type: "anh", attrs: { ...ANH.attrs, h: "900" } }],
    ["ghi am mang thuoc tinh cua anh", { type: "ghi-am", attrs: ANH.attrs }],
    ["ghi am thua w", { type: "ghi-am", attrs: { ...GHI_AM.attrs, w: 1 } }],
    ["ghi am 0 ms", { type: "ghi-am", attrs: { ...GHI_AM.attrs, ms: 0 } }],
    ["ghi am dai hon tran", { type: "ghi-am", attrs: { ...GHI_AM.attrs, ms: AUDIO_MAX_MS + 1 } }],
    ["song am thieu mot cot", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: SONG.slice(1) } }],
    ["song am thua mot cot", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: [...SONG, 0] } }],
    ["song am vuot PEAK_MAX", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: [PEAK_MAX + 1, ...SONG.slice(1)] } }],
    ["song am am", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: [-1, ...SONG.slice(1)] } }],
    ["song am le", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: [0.5, ...SONG.slice(1)] } }],
    ["song am la chuoi", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: ["5", ...SONG.slice(1)] } }],
    ["song am khong phai mang", { type: "ghi-am", attrs: { ...GHI_AM.attrs, peaks: { 0: 1 } } }],
    ["ten gan dung image", { type: "image", attrs: ANH.attrs }],
    ["ten gan dung voice", { type: "voice", attrs: GHI_AM.attrs }],
    ["bia khong phai khoi trong trang", { type: "bia", attrs: ANH.attrs }],
    ["anh trong trich dan", { type: "blockquote", content: [ANH] }],
    ["ghi am sau doan trong trich dan", { type: "blockquote", content: [doan("a"), GHI_AM] }],
    ["anh trong muc danh sach", { type: "bulletList", content: [{ type: "listItem", content: [ANH] }] }],
  ])("tu choi ca tai lieu: %s", (_ten, block) => {
    expect(cleanDoc(sau(block))).toBeNull();
  });

  it("media khong cong ky tu: dung tran chu cong them anh va ghi am van nhan", () => {
    const day = tai(doan("a".repeat(DOC_LIMITS.maxChars)), ANH, GHI_AM);
    expect(cleanDoc(day)).toEqual(day);
    expect(docCharCount(day)).toBe(DOC_LIMITS.maxChars);
    expect(roughCharCount(day)).toBe(DOC_LIMITS.maxChars);
  });

  it("dung DOC_LIMITS.maxMedia khoi media thi van nhan", () => {
    const day = nhieuMedia(DOC_LIMITS.maxMedia);
    expect(cleanDoc(day)).toEqual(day);
  });

  it("vuot DOC_LIMITS.maxMedia mot khoi thi tu choi ca tai lieu", () => {
    expect(cleanDoc(nhieuMedia(DOC_LIMITS.maxMedia + 1))).toBeNull();
  });
});

describe("checkDraftInput, checkPublishInput va checkReplyInput voi media", () => {
  it("nhap co media thi ok voi ban da qua cleanDoc; khoi media sai hinh thi invalid", () => {
    expect(checkDraftInput(tai(doan("Mưa"), ANH))).toEqual({ ok: true, doc: tai(doan("Mưa"), ANH) });
    expect(checkDraftInput(sau({ type: "anh", attrs: { id: ID } }))).toEqual({ ok: false, reason: "invalid" });
  });

  it("tong ky tu cua lan dang khong tinh media, to chi co media dang duoc; mot khoi media sai la invalid", () => {
    expect(checkPublishInput([tai(ANH), tai(doan("ab"), GHI_AM)])).toEqual({ ok: true, sheets: [tai(ANH), tai(doan("ab"), GHI_AM)] });
    expect(checkPublishInput([tai(doan("a")), sau({ ...ANH, content: [] })])).toEqual({ ok: false, reason: "invalid" });
  });

  it("trang tra loi chi co chu: co khoi media la invalid, o may chu va o trinh duyet nhu nhau", () => {
    for (const doc of [tai(ANH), tai(doan("Em nghĩ về anh"), GHI_AM)]) {
      expect(checkReplyInput(doc)).toEqual({ ok: false, reason: "invalid" });
      expect(checkReply(doc)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(checkReplyInput(tai(doan("Em nghĩ về anh")))).toEqual({ ok: true, doc: tai(doan("Em nghĩ về anh")) });
    expect(checkReplyInput(tai(doan("a".repeat(DOC_LIMITS.maxChars + 1)), ANH))).toEqual({
      ok: false, reason: "too-long", chars: DOC_LIMITS.maxChars + 1,
    });
  });
});

describe("chu cua tai lieu co media", () => {
  it("docText va docCharCount bo qua media: khong them dong, 0 ky tu", () => {
    expect(docText(tai(doan("Một"), ANH, doan("Hai"), GHI_AM))).toBe(["Một", "Hai"].join(LF));
    expect(docCharCount(tai(ANH, GHI_AM))).toBe(0);
    expect(docCharCount(tai(doan("abc"), ANH))).toBe(3);
  });

  it("co khoi media thi khong trong, ke ca khi khong co chu nao", () => {
    expect([tai(ANH), tai({ type: "paragraph" }, GHI_AM), tai(doan("   "), ANH)].map(isBlankDoc)).toEqual([false, false, false]);
    expect(isBlankDoc(tai({ type: "paragraph" }, doan(" ")))).toBe(true);
    expect([tai(doan("a")), tai(doan("a"), GHI_AM)].map(hasMediaBlock)).toEqual([false, true]);
  });

  it("to khong co chu ma co media: doan trich la nhan cua khoi media dau tien", () => {
    expect(docExcerpt(tai(ANH))).toBe("Một tấm ảnh.");
    expect(docExcerpt(tai(GHI_AM))).toBe("Một đoạn ghi âm.");
    expect(docExcerpt(tai({ type: "paragraph" }, GHI_AM, ANH, doan("  ")))).toBe("Một đoạn ghi âm.");
  });

  it("co chu thi doan trich chi lay chu, khong kem nhan", () => {
    expect(docExcerpt(tai(ANH, doan("Mưa đầu tháng"), GHI_AM))).toBe("Mưa đầu tháng");
  });

  it("trimTrailingBlank giu to cuoi chi co media, van bo to trong sau no", () => {
    const trong = tai({ type: "paragraph" });
    expect(trimTrailingBlank([tai(doan("a")), tai(ANH), trong])).toEqual([tai(doan("a")), tai(ANH)]);
  });

  it("sealTeaser khong bao gio goi y media: to chi co media la chuoi rong, to mo dau bang anh lay dong chu dau tien", () => {
    expect(sealTeaser(tai(ANH, GHI_AM))).toBe("");
    expect(sealTeaser(tai(ANH, doan("Dòng đầu"), GHI_AM, doan("Dòng hai")))).toBe("Dòng đầu");
  });
});

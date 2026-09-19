import { describe, it, expect } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { droppedMedia, fromEditorDoc, toEditorDoc } from "@/components/editor/pageEdit";
import { normalizeContinuation } from "@/lib/doc/continuation";
import { cleanDoc } from "@/lib/doc/validate";
import type { DocJson, ListItemNode } from "@/lib/doc/types";
import { PEAK_COUNT } from "@/lib/media/kinds";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";
const ID_3 = "3e5a7c9b-1d2f-4b6a-8c0e-9f1a2b3c4d5e";

const doan = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });
const muc = (text: string, noiTiep = false): ListItemNode =>
  noiTiep ? { type: "listItem", noiTiep: true, content: [doan(text)] } : { type: "listItem", content: [doan(text)] };
const anh = (id: string) => ({ type: "anh" as const, attrs: { id, w: 800, h: 600 } });
const ghiAm = (id: string) => ({ type: "ghi-am" as const, attrs: { id, ms: 4_000, peaks: Array.from({ length: PEAK_COUNT }, (_, i) => i % 50) } });

const CHU: DocJson = { type: "doc", content: [doan("Sáng nay trời mưa."), { type: "paragraph" }] };
const GIUA_DANH_SACH: DocJson = {
  type: "doc",
  content: [{ type: "bulletList", content: [muc("tiếp từ tờ trước", true), muc("mục mới")] }, doan("Hết.")],
};
const GIUA_TRICH_DAN: DocJson = {
  type: "doc",
  content: [{ type: "blockquote", content: [{ type: "bulletList", content: [muc("một", true), muc("hai")] }] }],
};
const CO_MEDIA: DocJson = { type: "doc", content: [doan("Ảnh:"), anh(ID), ghiAm(ID_2), doan("cuối")] };

describe("toEditorDoc va fromEditorDoc", () => {
  it.each<[string, DocJson]>([
    ["chu thuong", CHU],
    ["to bat dau giua danh sach", GIUA_DANH_SACH],
    ["danh sach noi tiep trong trich dan", GIUA_TRICH_DAN],
    ["co anh va ghi am", CO_MEDIA],
  ])("%s: di mot vong khong mat gi", (_ten, doc) => {
    expect(cleanDoc(fromEditorDoc(toEditorDoc(doc)))).toEqual(doc);
  });

  it("toEditorDoc chuyen noiTiep vao attrs, muc thuong khong co attrs", () => {
    const [list] = toEditorDoc(GIUA_DANH_SACH).content ?? [];
    const [dau, sau] = list.content ?? [];
    expect(dau).toEqual({ type: "listItem", attrs: { noiTiep: true }, content: [doan("tiếp từ tờ trước")] });
    expect(dau).not.toHaveProperty("noiTiep");
    expect(sau).toEqual({ type: "listItem", content: [doan("mục mới")] });
  });

  it("toEditorDoc khong doi dau vao", () => {
    const truoc = structuredClone(GIUA_DANH_SACH);
    toEditorDoc(GIUA_DANH_SACH);
    expect(GIUA_DANH_SACH).toEqual(truoc);
  });

  it("fromEditorDoc bo moi attrs khac cua muc danh sach, giu noiTiep khi dung la true", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", attrs: { noiTiep: true, la: 1 }, content: [doan("a")] },
            { type: "listItem", attrs: { noiTiep: null }, content: [doan("b")] },
            { type: "listItem", attrs: { noiTiep: "true" }, content: [doan("c")] },
          ],
        },
      ],
    };
    expect(fromEditorDoc(json)).toEqual({
      type: "doc",
      content: [{ type: "bulletList", content: [muc("a", true), muc("b"), muc("c")] }],
    });
  });

  it("fromEditorDoc giu attrs cua khoi media", () => {
    expect(fromEditorDoc(toEditorDoc(CO_MEDIA))).toEqual(CO_MEDIA);
  });
});

describe("normalizeContinuation", () => {
  it("giu dau o muc dau tien cua danh sach dau", () => {
    expect(normalizeContinuation(GIUA_DANH_SACH)).toEqual(GIUA_DANH_SACH);
  });

  it("giu dau o muc dau tien xuyen qua trich dan", () => {
    expect(normalizeContinuation(GIUA_TRICH_DAN)).toEqual(GIUA_TRICH_DAN);
  });

  it("bo dau o muc thu hai cua danh sach dau (Enter chep thuoc tinh)", () => {
    const doc: DocJson = { type: "doc", content: [{ type: "bulletList", content: [muc("a", true), muc("b", true), muc("c")] }] };
    expect(normalizeContinuation(doc)).toEqual({ type: "doc", content: [{ type: "bulletList", content: [muc("a", true), muc("b"), muc("c")] }] });
  });

  it("muc dau khong co dau thi khong mat dau o dau ca, cung khong them", () => {
    const doc: DocJson = { type: "doc", content: [{ type: "bulletList", content: [muc("a"), muc("b", true)] }] };
    expect(normalizeContinuation(doc)).toEqual({ type: "doc", content: [{ type: "bulletList", content: [muc("a"), muc("b")] }] });
  });

  it("bo dau o danh sach thu hai", () => {
    const doc: DocJson = {
      type: "doc",
      content: [{ type: "bulletList", content: [muc("a", true)] }, doan("giữa"), { type: "bulletList", content: [muc("x", true)] }],
    };
    expect(normalizeContinuation(doc)).toEqual({
      type: "doc",
      content: [{ type: "bulletList", content: [muc("a", true)] }, doan("giữa"), { type: "bulletList", content: [muc("x")] }],
    });
  });

  it("khoi dau la doan van: bo moi dau", () => {
    const doc: DocJson = { type: "doc", content: [doan("mở"), { type: "bulletList", content: [muc("a", true)] }] };
    expect(normalizeContinuation(doc)).toEqual({ type: "doc", content: [doan("mở"), { type: "bulletList", content: [muc("a")] }] });
  });

  it("khong doi dau vao", () => {
    const doc: DocJson = { type: "doc", content: [{ type: "bulletList", content: [muc("a", true), muc("b", true)] }] };
    const truoc = structuredClone(doc);
    normalizeContinuation(doc);
    expect(doc).toEqual(truoc);
  });
});

describe("droppedMedia", () => {
  it("false khi moi media cua ban goc con, ke ca doi cho va them anh moi", () => {
    const hienTai = toEditorDoc({ type: "doc", content: [ghiAm(ID_2), anh(ID_3), doan("x"), anh(ID)] });
    expect(droppedMedia(CO_MEDIA, hienTai)).toBe(false);
  });

  it("true khi thieu mot media goc", () => {
    expect(droppedMedia(CO_MEDIA, toEditorDoc({ type: "doc", content: [anh(ID)] }))).toBe(true);
  });

  it("true khi bo A them B, du so khoi media khong giam", () => {
    expect(droppedMedia(CO_MEDIA, toEditorDoc({ type: "doc", content: [anh(ID_3), ghiAm(ID_2)] }))).toBe(true);
  });

  it("ban goc khong co media: luon false", () => {
    expect(droppedMedia(CHU, { type: "doc", content: [] })).toBe(false);
  });
});

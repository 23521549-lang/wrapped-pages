import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocView } from "@/components/doc/DocView";
import { docCharCount } from "@/lib/doc/text";
import type { BlockNode, DocJson } from "@/lib/doc/types";
import { isStorable } from "@/lib/storable";

const html = (...content: BlockNode[]) => renderToStaticMarkup(createElement(DocView, { doc: { type: "doc", content } as DocJson, author: "Linh" }));
const boThe = (s: string) => s.replace(/<[^>]*>/g, "");

describe("DocView", () => {
  it("doan co dinh dang va xuong dong; dinh dang dau tien nam ngoai cung", () => {
    expect(html({
      type: "paragraph",
      content: [
        { type: "text", text: "Mưa ", marks: [{ type: "bold" }] },
        { type: "text", text: "đầu tháng", marks: [{ type: "italic" }, { type: "underline" }] },
        { type: "hardBreak" },
        { type: "text", text: "chín" },
      ],
    })).toBe("<p><strong>Mưa </strong><em><u>đầu tháng</u></em><br/>chín</p>");
  });

  it("doan ket thuc bang hardBreak thi co them mot br de cao bang editor", () => {
    expect(html({ type: "paragraph", content: [{ type: "text", text: "chín" }, { type: "hardBreak" }] }))
      .toBe("<p>chín<br/><br/></p>");
  });

  it("ba dinh dang long nhau dung thu tu cua mang marks", () => {
    expect(html({ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }] }] }))
      .toBe("<p><strong><em><u>a</u></em></strong></p>");
  });

  it("dau doan tren ke khong ve the nao o man doc, ke ca khi di cung dinh dang khac", () => {
    const rieng = html({ type: "paragraph", content: [{ type: "text", text: "mưa nhẹ", marks: [{ type: "doanKe" }] }] });
    expect(rieng).toBe("<p>mưa nhẹ</p>");
    expect(rieng).not.toContain("doan-ke");
    expect(html({ type: "paragraph", content: [{ type: "text", text: "mưa nhẹ", marks: [{ type: "doanKe" }, { type: "bold" }] }] }))
      .toBe("<p><strong>mưa nhẹ</strong></p>");
  });

  it("danh sach, trich dan va doan trong", () => {
    expect(html(
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "một" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "hai" }] }] },
      ] },
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "trích" }] }] },
      { type: "paragraph" },
    )).toBe("<ul><li><p>một</p></li><li><p>hai</p></li></ul><blockquote><p>trích</p></blockquote><p></p>");
  });

  it("muc noi tiep tu to truoc mang class noi-tiep de khong ve lai dau cham", () => {
    expect(html({ type: "bulletList", content: [
      { type: "listItem", noiTiep: true, content: [{ type: "paragraph", content: [{ type: "text", text: "tiếp" }] }] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "mới" }] }] },
    ] })).toBe('<ul><li class="noi-tiep"><p>tiếp</p></li><li><p>mới</p></li></ul>');
  });

  it("chu dang ma HTML chi la chu, duoc thoat", () => {
    const out = html({ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] });
    expect(out).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(out).not.toContain("<script>");
  });

  it("nhanh mac dinh tra ve rong cho mot loai khoi khong biet, khong nem loi", () => {
    // Gia lap kich ban them mot loai khoi vao BlockNode ma quen sua file nay: ep kieu qua
    // unknown de tranh loi bien dich (tsc phai tu bao loi that qua nhanh default's never),
    // nhung o day chi kiem hanh vi luc chay: khong nem, chi lang le khong hien gi.
    const la = { type: "khong-biet" } as unknown as BlockNode;
    expect(html(la)).toBe("");
  });
});

describe("DocView: typing cua nghi thuc mo", () => {
  const TRO = createElement("span", { className: "con-tro" });
  const go = (shown: number, content: BlockNode[]) =>
    renderToStaticMarkup(createElement(DocView, { doc: { type: "doc", content } as DocJson, author: "Linh", typing: { shown, caret: TRO } }));

  /** 11 ky tu: "Xin " 4, "chao" 4 (dam), "anh" 3. */
  const XIN: BlockNode[] = [
    { type: "paragraph", content: [{ type: "text", text: "Xin " }, { type: "text", text: "chào", marks: [{ type: "bold" }] }] },
    { type: "paragraph", content: [{ type: "text", text: "anh" }] },
  ];
  /** 13 ky tu: "ab" 2, "mot" 3, "hai" 3, "trich" 5. */
  const DS: BlockNode[] = [
    { type: "paragraph", content: [{ type: "text", text: "ab" }] },
    { type: "bulletList", content: [
      { type: "listItem", noiTiep: true, content: [{ type: "paragraph", content: [{ type: "text", text: "một" }] }] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "hai" }] }] },
    ] },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "trích" }] }] },
  ];
  /** 4 don vi UTF-16: "a" 1, emoji 2, "b" 1. */
  const EMOJI: BlockNode[] = [{ type: "paragraph", content: [{ type: "text", text: "a😀b" }] }];
  const XUONG: BlockNode[] = [{ type: "paragraph", content: [{ type: "text", text: "c" }, { type: "hardBreak" }, { type: "text", text: "d" }] }];

  it("phan chua go van nam trong dong, boc trong chua-go va giu dinh dang; con tro ngay sau ky tu cuoi da hien", () => {
    expect(go(6, XIN)).toBe(
      '<p>Xin <strong>ch<span class="con-tro"></span><span class="chua-go">ào</span></strong></p><p><span class="chua-go">anh</span></p>',
    );
    expect(go(0, XIN)).toBe(
      '<p><span class="con-tro"></span><span class="chua-go">Xin </span><strong><span class="chua-go">chào</span></strong></p><p><span class="chua-go">anh</span></p>',
    );
  });

  it("go het thi khong con chua-go, con tro dung sau ky tu cuoi cung", () => {
    expect(go(11, XIN)).toBe('<p>Xin <strong>chào</strong></p><p>anh<span class="con-tro"></span></p>');
    expect(go(500, XIN)).toBe(go(11, XIN));
  });

  it("hardBreak dem mot ky tu va luon duoc ve; con tro dung truoc no khi chua toi, sau no khi da qua", () => {
    expect(go(1, XUONG)).toBe('<p>c<span class="con-tro"></span><br/><span class="chua-go">d</span></p>');
    expect(go(2, XUONG)).toBe('<p>c<br/><span class="con-tro"></span><span class="chua-go">d</span></p>');
    expect(go(2, [{ type: "paragraph", content: [{ type: "text", text: "c" }, { type: "hardBreak" }] }]))
      .toBe('<p>c<br/><span class="con-tro"></span><br/></p>');
  });

  it("muc danh sach va trich dan chua toi luot thi an dau cham va vach trai, van giu noi-tiep", () => {
    expect(go(1, DS)).toBe(
      '<p>a<span class="con-tro"></span><span class="chua-go">b</span></p>'
      + '<ul><li class="noi-tiep chua-go-khoi"><p><span class="chua-go">một</span></p></li><li class="chua-go-khoi"><p><span class="chua-go">hai</span></p></li></ul>'
      + '<blockquote class="chua-go-khoi"><p><span class="chua-go">trích</span></p></blockquote>',
    );
    expect(go(2, DS)).toBe(
      '<p>ab</p>'
      + '<ul><li class="noi-tiep"><p><span class="con-tro"></span><span class="chua-go">một</span></p></li><li class="chua-go-khoi"><p><span class="chua-go">hai</span></p></li></ul>'
      + '<blockquote class="chua-go-khoi"><p><span class="chua-go">trích</span></p></blockquote>',
    );
    expect(go(13, DS)).toBe('<p>ab</p><ul><li class="noi-tiep"><p>một</p></li><li><p>hai</p></li></ul><blockquote><p>trích<span class="con-tro"></span></p></blockquote>');
  });

  it("khong bao gio xe doi mot cap surrogate: emoji hien tron mot lan", () => {
    expect(go(2, EMOJI)).toBe('<p>a<span class="con-tro"></span><span class="chua-go">😀b</span></p>');
    expect(go(3, EMOJI)).toBe('<p>a😀<span class="con-tro"></span><span class="chua-go">b</span></p>');
  });

  it("o moi nhip: du chu luon co mat, dung mot con tro, phan hien la phan dau cua chu va khong co nua cap surrogate", () => {
    for (const content of [XIN, DS, EMOJI, XUONG]) {
      const tong = docCharCount({ type: "doc", content });
      const du = boThe(go(tong, content));
      for (let n = 0; n <= tong; n++) {
        const out = go(n, content);
        const hien = boThe(out.replace(/<span class="chua-go">[^<]*<[/]span>/g, ""));
        expect(boThe(out), `n=${n}`).toBe(du);
        expect(out.split('class="con-tro"').length, `n=${n}`).toBe(2);
        expect(du.startsWith(hien) && isStorable(hien), `n=${n}`).toBe(true);
      }
    }
  });
});

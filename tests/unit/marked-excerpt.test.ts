import { describe, expect, it } from "vitest";
import { markedExcerpt } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";

const dau = (text: string) => ({ type: "text" as const, text, marks: [{ type: "doanKe" as const }] });
const thuong = (text: string) => ({ type: "text" as const, text });

describe("markedExcerpt", () => {
  it("lay dung chu mang dau, bo phan khong mang dau", () => {
    const doc: DocJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [thuong("Hôm ấy "), dau("mưa rất nhẹ"), thuong(" và lâu.")] }],
    };
    expect(markedExcerpt(doc)).toBe("mưa rất nhẹ");
  });

  it("dau nam o nhieu khoi thi noi lai, gop khoang trang", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        { type: "paragraph", content: [dau("Mình về  ")] },
        { type: "blockquote", content: [{ type: "paragraph", content: [dau("   nhà nhé")] }] },
      ],
    };
    expect(markedExcerpt(doc)).toBe("Mình về nhà nhé");
  });

  it("dau nam o nhieu nut chu lien nhau trong cung mot doan thi noi lien, khong chen khoang trang", () => {
    const doc: DocJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [dau("mưa "), dau("rất "), dau("nhẹ"), thuong(" và lâu")] }],
    };
    expect(markedExcerpt(doc)).toBe("mưa rất nhẹ");
  });

  it("dau tren muc danh sach cung duoc lay", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [dau("một")] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [thuong("hai")] }] },
          ],
        },
      ],
    };
    expect(markedExcerpt(doc)).toBe("một");
  });

  it("khong co dau, hay chu mang dau chi toan khoang trang, thi null", () => {
    const khongDau: DocJson = { type: "doc", content: [{ type: "paragraph", content: [thuong("chỉ chữ thường")] }] };
    const trang: DocJson = { type: "doc", content: [{ type: "paragraph", content: [dau(String.fromCharCode(32, 160, 9))] }] };
    expect([markedExcerpt(khongDau), markedExcerpt(trang)]).toEqual([null, null]);
  });

  it("to trong hay to chi co media thi null", () => {
    const trong: DocJson = { type: "doc", content: [{ type: "paragraph" }] };
    const chiAnh: DocJson = {
      type: "doc",
      content: [{ type: "anh", attrs: { id: "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e", w: 10, h: 10 } }],
    };
    expect([markedExcerpt(trong), markedExcerpt(chiAnh)]).toEqual([null, null]);
  });

  it("dai qua thi cat o ranh gioi tu, them dau ba cham", () => {
    const doc: DocJson = { type: "doc", content: [{ type: "paragraph", content: [dau("một hai ba bốn năm sáu bảy")] }] };
    expect(markedExcerpt(doc, 12)).toBe(`một hai ba${String.fromCharCode(8230)}`);
  });

  it("khoi media khong co chu nen khong lam hong phep duyet", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        { type: "anh", attrs: { id: "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e", w: 10, h: 10 } },
        { type: "paragraph", content: [dau("còn đây là chữ")] },
      ],
    };
    expect(markedExcerpt(doc)).toBe("còn đây là chữ");
  });
});

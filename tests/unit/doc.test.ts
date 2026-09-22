import { describe, it, expect } from "vitest";
import { checkDraftInput, checkPublishInput, cleanDoc, DOC_LIMITS, PUBLISH_TOTAL_MAX_CHARS } from "@/lib/doc/validate";
import { cutAtWord, docCharCount, docExcerpt, docText, isBlankDoc, roughCharCount, trimTrailingBlank } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";

const FULL: DocJson = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Mưa ", marks: [{ type: "bold" }] },
        { type: "text", text: "đầu tháng", marks: [{ type: "italic" }, { type: "underline" }] },
        { type: "hardBreak" },
        { type: "text", text: "chín" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "một" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "hai" }] }] },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "trích" }] }] },
    { type: "paragraph" },
  ],
};

const doan = (text: string): DocJson => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("cleanDoc", () => {
  it("nhan du moi loai khoi va dinh dang cho phep, tra lai y nguyen", () => {
    expect(cleanDoc(FULL)).toEqual(FULL);
  });

  it("bo thuoc tinh la nhung giu noi dung", () => {
    const dirty = {
      type: "doc", attrs: { x: 1 },
      content: [{
        type: "paragraph", attrs: { textAlign: "center" }, id: "abc",
        content: [{ type: "text", text: "a", marks: [{ type: "bold", attrs: { y: 2 } }] }],
      }],
    };
    expect(cleanDoc(dirty)).toEqual({
      type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }] }] }],
    });
  });

  it("gop dinh dang trung lap", () => {
    const d = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }, { type: "bold" }] }] }] };
    expect(cleanDoc(d)).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }] }] }] });
  });

  it("giu dau noiTiep cua muc danh sach khi la true, bo khi la gia tri khac", () => {
    const item = (extra: object) => ({
      type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", ...extra, content: [{ type: "paragraph" }] }] }],
    });
    expect(cleanDoc(item({ noiTiep: true }))).toEqual(item({ noiTiep: true }));
    expect(cleanDoc(item({ noiTiep: "co" }))).toEqual(item({}));
  });

  it("giu dau noiTiep tren doan, danh sach va trich dan khi la boolean, bo khi la gia tri khac", () => {
    const doanCo = (extra: object) => ({ type: "doc", content: [{ type: "paragraph", ...extra, content: [{ type: "text", text: "a" }] }] });
    expect(cleanDoc(doanCo({ noiTiep: true }))).toEqual(doanCo({ noiTiep: true }));
    expect(cleanDoc(doanCo({ noiTiep: 1 }))).toEqual(doanCo({}));
    const doanRong = { type: "doc", content: [{ type: "paragraph", noiTiep: true }] };
    expect(cleanDoc(doanRong)).toEqual(doanRong);
    const ds = (extra: object) => ({
      type: "doc", content: [{ type: "bulletList", ...extra, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }],
    });
    expect(cleanDoc(ds({ noiTiep: true }))).toEqual(ds({ noiTiep: true }));
    expect(cleanDoc(ds({ noiTiep: "co" }))).toEqual(ds({}));
    const trich = (extra: object) => ({ type: "doc", content: [{ type: "blockquote", ...extra, content: [{ type: "paragraph" }] }] });
    expect(cleanDoc(trich({ noiTiep: true }))).toEqual(trich({ noiTiep: true }));
    expect(cleanDoc(trich({ noiTiep: false }))).toEqual(trich({ noiTiep: false }));
    expect(cleanDoc(doanCo({ noiTiep: false }))).toEqual(doanCo({ noiTiep: false }));
    expect(cleanDoc(ds({ noiTiep: false }))).toEqual(ds({ noiTiep: false }));
    expect(cleanDoc(trich({ noiTiep: "false" }))).toEqual(trich({}));
  });

  it.each([
    ["loai khoi la", { type: "doc", content: [{ type: "heading", content: [] }] }],
    ["dinh dang la", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "link" }] }] }] }],
    ["anh sai thuoc tinh", { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] }],
    ["text khong phai chuoi", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: 5 }] }] }],
    ["tai lieu khong co khoi nao", { type: "doc", content: [] }],
    ["goc khong phai doc", { type: "paragraph" }],
    ["danh sach rong", { type: "doc", content: [{ type: "bulletList", content: [] }] }],
    ["muc danh sach khong phai mot doan", {
      type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "blockquote", content: [{ type: "paragraph" }] }] }] }],
    }],
    ["muc danh sach co hai doan", {
      type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }, { type: "paragraph" }] }] }],
    }],
    ["danh sach long nhau", {
      type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [
        { type: "paragraph" }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      ] }] }],
    }],
    ["null", null],
    ["chuoi", "doc"],
  ])("tu choi: %s", (_ten, input) => {
    expect(cleanDoc(input)).toBeNull();
  });

  it("tu choi khi vuot tran ky tu", () => {
    expect(cleanDoc(doan("a".repeat(DOC_LIMITS.maxChars + 1)))).toBeNull();
    expect(cleanDoc(doan("a".repeat(DOC_LIMITS.maxChars)))).not.toBeNull();
  });

  it("tu choi khi long qua sau, nhan khi vua du sau", () => {
    const long = (n: number): unknown => {
      let node: unknown = { type: "paragraph" };
      for (let i = 0; i < n; i++) node = { type: "blockquote", content: [node] };
      return { type: "doc", content: [node] };
    };
    expect(cleanDoc(long(DOC_LIMITS.maxDepth - 1))).not.toBeNull();
    expect(cleanDoc(long(DOC_LIMITS.maxDepth + 1))).toBeNull();
  });

  // Danh sach long trong danh sach (bulletList > listItem > bulletList > ...) di qua mot duong
  // de quy khac voi blockquote: cleanBlock goi thang cho muc danh sach, khong qua cleanBlocks.
  // Luat "muc danh sach chi dung mot doan" van khien chuoi nay luon bi tu choi, nhung phep thu
  // o day la: tu choi co dung tra ve null hay khong, chu khong nem loi tran ngan xep.
  const bulletChain = (n: number): unknown => {
    let node: unknown = { type: "paragraph" };
    for (let i = 0; i < n; i++) node = { type: "bulletList", content: [{ type: "listItem", content: [node] }] };
    return { type: "doc", content: [node] };
  };

  it("danh sach long trong danh sach o dung bien do sau van tra null, khong nem", () => {
    expect(cleanDoc(bulletChain(DOC_LIMITS.maxDepth))).toBeNull();
  });

  it("danh sach long rat sau (50 000 tang) tra null chu khong nem loi tran ngan xep", () => {
    expect(cleanDoc(bulletChain(50_000))).toBeNull();
  });

  it("bo ky tu NUL, bo luon doan text rong sau khi bo", () => {
    const d = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a\u0000b" }, { type: "text", text: "\u0000" }] }] };
    expect(cleanDoc(d)).toEqual(doan("ab"));
  });

  it("bo nua cap surrogate le, giu emoji day du", () => {
    const d = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: `a${String.fromCharCode(0xd800)}b${String.fromCharCode(0xd83d, 0xde00)}` }],
      }],
    };
    expect(cleanDoc(d)).toEqual(doan(`ab${String.fromCharCode(0xd83d, 0xde00)}`));
  });

  it("chi la surrogate thap le thi bo, bo luon doan text rong sau khi bo", () => {
    const d = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: String.fromCharCode(0xdc00) }] }] };
    expect(cleanDoc(d)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("chu dang ma HTML chi la chu", () => {
    expect(cleanDoc(doan("<script>alert(1)</script>"))).toEqual(doan("<script>alert(1)</script>"));
  });
});

describe("chu cua tai lieu", () => {
  it("docText noi cac doan bang xuong dong, xuong dong trong doan cung la xuong dong", () => {
    expect(docText(FULL)).toBe("Mưa đầu tháng\nchín\nmột\nhai\ntrích\n");
  });

  it("isBlankDoc chi dung khi khong co chu nao", () => {
    expect(isBlankDoc({ type: "doc", content: [{ type: "paragraph" }, { type: "paragraph" }] })).toBe(true);
    expect(isBlankDoc(doan("   "))).toBe(true);
    expect(isBlankDoc(doan("a"))).toBe(false);
  });

  it("docExcerpt gop khoang trang, giu nguyen chu ngan", () => {
    expect(docExcerpt(FULL)).toBe("Mưa đầu tháng chín một hai trích");
  });

  it("docExcerpt cat o ranh gioi tu va them dau ba cham", () => {
    const long = doan("Em tới sớm hơn giờ hẹn bốn mươi phút, ngồi ở cái ghế nhựa xanh gần quầy vé.");
    expect(docExcerpt(long, 30)).toBe("Em tới sớm hơn giờ hẹn bốn…");
  });

  it("trimTrailingBlank chi bo cac tai lieu trong o cuoi", () => {
    const trong: DocJson = { type: "doc", content: [{ type: "paragraph" }] };
    expect(trimTrailingBlank([doan("a"), trong, trong])).toEqual([doan("a")]);
    expect(trimTrailingBlank([trong, doan("a")])).toEqual([trong, doan("a")]);
    expect(trimTrailingBlank([trong])).toEqual([]);
  });

  it("docCharCount dem giong het budget cua cleanDoc: moi ky tu 1, hardBreak 1, dinh dang khong tinh", () => {
    // "Mua "(4) + "dau thang"(9) + hardBreak(1) + "chin"(4) + "mot"(3) + "hai"(3) + "trich"(5) + doan trong(0).
    expect(docCharCount(FULL)).toBe(29);
  });

  it("docCharCount cong don ca danh sach va trich dan long nhau", () => {
    const d: DocJson = {
      type: "doc",
      content: [
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "một" }] }] },
        ] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "hai ba" }] }] },
      ],
    };
    expect(docCharCount(d)).toBe("một".length + "hai ba".length);
  });
});

describe("cutAtWord", () => {
  it("dung max ky tu thi giu nguyen, khong them dau ba cham", () => {
    expect(cutAtWord("x".repeat(80), 80)).toBe("x".repeat(80));
  });

  it("khong co khoang trang de cat thi cat cung o max va them dau ba cham", () => {
    expect(cutAtWord("x".repeat(200), 80)).toBe(`${"x".repeat(80)}…`);
  });

  it("khoang trang qua som (truoc 60% max) thi van cat cung", () => {
    expect(cutAtWord(`ab ${"x".repeat(200)}`, 80)).toBe(`ab ${"x".repeat(77)}…`);
  });

  it("cat cung khong xe doi emoji", () => {
    const emoji = String.fromCharCode(0xd83d, 0xde00);
    expect(cutAtWord(`a${emoji.repeat(50)}`, 80)).toBe(`a${emoji.repeat(39)}…`);
  });
});

describe("roughCharCount (uoc luong truoc cleanDoc)", () => {
  it("dem chu trong cau truc hop le, giong docCharCount sau khi cleanDoc", () => {
    const input = doan("a".repeat(50));
    expect(roughCharCount(input)).toBe(50);
  });

  it("dem ca hardBreak va chu long trong danh sach, trich dan, du chua qua cleanDoc", () => {
    const input = {
      type: "doc",
      content: [
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "abc" }, { type: "hardBreak" }] }] },
        ] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "de" }] }] },
      ],
    };
    expect(roughCharCount(input)).toBe(3 + 1 + 2);
  });

  it("khong nem loi tran ngan xep voi cau truc long rat sau (duyet bang ngan xep, khong de quy)", () => {
    let node: unknown = { type: "paragraph", content: [{ type: "text", text: "sâu" }] };
    for (let i = 0; i < 100_000; i++) node = { type: "blockquote", content: [node] };
    expect(roughCharCount({ type: "doc", content: [node] })).toBe(3);
  });

  it("gia tri khong phai doi tuong hop le thi dem la 0, khong nem", () => {
    expect(roughCharCount(null)).toBe(0);
    expect(roughCharCount("doc")).toBe(0);
    expect(roughCharCount(42)).toBe(0);
    expect(roughCharCount({ type: "doc" })).toBe(0);
  });
});

describe("checkDraftInput (thong diep rieng khi vuot tran do dai)", () => {
  it("tai lieu hop le va duoi tran: ok true, doc giong het cleanDoc", () => {
    const input = doan("nội dung ngắn");
    const r = checkDraftInput(input);
    expect(r).toEqual({ ok: true, doc: cleanDoc(input) });
  });

  it("vuot tran do dai: bao rieng ly do too-long kem so chu, KHONG lan voi invalid", () => {
    const r = checkDraftInput(doan("a".repeat(DOC_LIMITS.maxChars + 500)));
    expect(r).toEqual({ ok: false, reason: "too-long", chars: DOC_LIMITS.maxChars + 500 });
  });

  it("dung ngay tai tran, khong bi tinh la vuot", () => {
    const r = checkDraftInput(doan("a".repeat(DOC_LIMITS.maxChars)));
    expect(r.ok).toBe(true);
  });

  it("loi cau truc that su (khong phai do dai) van la reason invalid", () => {
    expect(checkDraftInput({ type: "doc", content: [{ type: "heading" }] })).toEqual({ ok: false, reason: "invalid" });
    expect(checkDraftInput(null)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("checkPublishInput (tran tong cho ca lan dang, doc lap voi tran rieng tung to)", () => {
  const toN = (n: number): DocJson => doan("a".repeat(n));

  it("cac to hop le, tong duoi tran: ok true", () => {
    const r = checkPublishInput([toN(10), toN(20)]);
    expect(r).toEqual({ ok: true, sheets: [toN(10), toN(20)] });
  });

  it("moi to rieng duoi tran DOC_LIMITS.maxChars nhung TONG vuot PUBLISH_TOTAL_MAX_CHARS: too-long", () => {
    // Can nhieu hon 5 to day DOC_LIMITS.maxChars (20 000) moi to de vuot PUBLISH_TOTAL_MAX_CHARS
    // (100 000): day chinh la ly do PUBLISH_TOTAL_MAX_CHARS phai la mot con so RIENG, lon hon han
    // DOC_LIMITS.maxChars - hai to day tran rieng cong lai (toi da 40 000) van khong the vuot no.
    const to = toN(DOC_LIMITS.maxChars);
    const sheets = Array.from({ length: 6 }, () => to);
    const r = checkPublishInput(sheets);
    expect(r).toEqual({ ok: false, reason: "too-long", chars: DOC_LIMITS.maxChars * 6 });
  });

  it("dung ngay tai tran tong (5 to day DOC_LIMITS.maxChars = dung PUBLISH_TOTAL_MAX_CHARS), khong bi tinh la vuot", () => {
    const to = toN(DOC_LIMITS.maxChars);
    const sheets = Array.from({ length: 5 }, () => to);
    expect(DOC_LIMITS.maxChars * 5).toBe(PUBLISH_TOTAL_MAX_CHARS);
    expect(checkPublishInput(sheets).ok).toBe(true);
  });

  it("mot to loi cau truc lam tu choi ca lan dang, bao invalid chu khong phai too-long", () => {
    const r = checkPublishInput([toN(10), { type: "doc", content: [{ type: "image" }] }]);
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });

  it("mang rong: tong la 0, ok true (actionPublish tu choi mang rong o buoc truoc, rieng ham nay khong)", () => {
    expect(checkPublishInput([])).toEqual({ ok: true, sheets: [] });
  });
});

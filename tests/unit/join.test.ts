import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { editorExtensions } from "@/components/editor/extensions";
import { blockBoundary, splitDoc } from "@/components/editor/split";
import { joinSheets } from "@/lib/doc/join";
import type { DocJson } from "@/lib/doc/types";
import { cleanDoc } from "@/lib/doc/validate";

/*
 * joinSheets la nguoc cua splitDoc tren cac to cua mot luot: noi roi cat lai o cung cho ngat phai ra dung cac to cu,
 * thi xep trang lai (ham cua tai lieu va kho giay) ngat dung cho cu khi chua sua gi. Bai tinh chat chay moi cho ngat
 * ma measureUnits co the dua ra tren mot tai lieu du loai khoi.
 */

const schema = getSchema(editorExtensions("Mạnh"));
const t = (text: string, marks?: string[]) => (marks ? { type: "text", text, marks: marks.map((m) => ({ type: m })) } : { type: "text", text });
const p = (...content: object[]) => (content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" });
const li = (text: string) => ({ type: "listItem", content: [p(t(text))] });
const ANH = "0b6f9d2c-4a1e-4c3b-9f7d-2e5a8c1b3d4f";

const MAU = PMNode.fromJSON(schema, {
  type: "doc",
  content: [
    p(t("Mở đầu dài "), t("đậm", ["bold"]), t(" rồi thường")),
    p(t("Dòng một"), { type: "hardBreak" }, t("dòng hai sau xuống dòng")),
    { type: "bulletList", content: [li("một hai ba"), li("bốn năm sáu bảy"), li("tám")] },
    { type: "anh", attrs: { id: ANH, w: 1200, h: 900 } },
    { type: "blockquote", content: [p(t("trích một câu")), { type: "bulletList", content: [li("trong trích")] }, p(t("trích hai câu"))] },
    p(),
    p(t("Sau cùng")),
  ],
});

/** Moi vi tri ngat ma measureUnits co the dua ra: bien khoi an toan cua dong dau, va dau moi dong sau trong doan. */
function viTriNgat(doc: PMNode): number[] {
  const out = new Set<number>();
  doc.descendants((node, pos) => {
    if (node.type.name === "anh" || node.type.name === "ghi-am") {
      out.add(pos);
      return false;
    }
    if (node.isTextblock) {
      out.add(blockBoundary(doc, pos));
      for (let o = 1; o <= node.content.size; o++) out.add(pos + 1 + o);
      return false;
    }
    return true;
  });
  return [...out].filter((x) => x > 0 && x < doc.content.size).sort((a, b) => a - b);
}

/** So gia ngau nhien tat dinh, de bai kiem lap lai dung y nhu nhau. */
function soGia(hat: number) {
  let s = hat;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Cat nhu splitDoc, hoac null khi cho ngat lam rong mot khoi (splitDoc nem, bo xep trang khong bao gio dua ra). */
function cat(doc: PMNode, cho: readonly number[]): DocJson[] | null {
  try {
    return splitDoc(doc, cho);
  } catch {
    return null;
  }
}

/** To cat theo cach cu: chi muc danh sach mang dau noiTiep. */
function cachCu(to: DocJson[]): DocJson[] {
  return JSON.parse(JSON.stringify(to, (_k, v: unknown) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return v;
    const { noiTiep, ...rest } = v as Record<string, unknown>;
    return rest.type === "listItem" && noiTiep === true ? v : rest;
  })) as DocJson[];
}

describe("joinSheets: to cat theo cach moi", () => {
  it("mot cho ngat bat ky: noi lai ra dung tai lieu goc, moi to van qua cleanDoc nguyen ven", () => {
    let lan = 0;
    for (const x of viTriNgat(MAU)) {
      const to = cat(MAU, [x]);
      if (!to) continue;
      lan++;
      expect(joinSheets(to), `ngat o ${x}`).toEqual(MAU.toJSON());
      for (const s of to) expect(cleanDoc(s), `ngat o ${x}`).toEqual(s);
    }
    expect(lan).toBeGreaterThan(40);
  });

  it("nhieu cho ngat ngau nhien: noi roi cat lai o cung cho ra dung cac to cu", () => {
    const cho = viTriNgat(MAU);
    const ngauNhien = soGia(7);
    let lan = 0;
    for (let k = 0; k < 400; k++) {
      const chon = cho.filter(() => ngauNhien() < 0.2);
      const to = cat(MAU, chon);
      if (!to) continue;
      lan++;
      const noi = joinSheets(to);
      expect(noi).toEqual(MAU.toJSON());
      expect(splitDoc(PMNode.fromJSON(schema, noi), chon)).toEqual(to);
    }
    expect(lan).toBeGreaterThan(50);
  });

  it("doan ket thuc bang Shift+Enter roi sang doan moi o to sau: khong noi, khi luot co dau cach moi", () => {
    const hai = PMNode.fromJSON(schema, { type: "doc", content: [p(t("Một hai ba")), p(t("Kết"), { type: "hardBreak" }), p(t("Sau"))] });
    const to = splitDoc(hai, [1 + "Một ".length, hai.child(0).nodeSize + hai.child(1).nodeSize]);
    expect(joinSheets(to)).toEqual(hai.toJSON());
  });

  it("khong doi dau vao, khong con dau noiTiep nao trong tai lieu noi", () => {
    const to = splitDoc(MAU, [viTriNgat(MAU)[3]]);
    const truoc = JSON.stringify(to);
    expect(JSON.stringify(joinSheets(to))).not.toContain("noiTiep");
    expect(JSON.stringify(to)).toBe(truoc);
  });
});

describe("joinSheets: to cat theo cach cu (chi muc danh sach co dau)", () => {
  it("cat giua doan: phan sau thanh doan rieng, cat lai o bien doan ra dung cac to cu", () => {
    const doc = PMNode.fromJSON(schema, { type: "doc", content: [p(t("Một hai ba bốn năm")), p(t("Sáu"))] });
    const cu = cachCu(splitDoc(doc, [1 + "Một hai ".length]));
    const noi = joinSheets(cu);
    expect(noi).toEqual({ type: "doc", content: [p(t("Một hai ")), p(t("ba bốn năm")), p(t("Sáu"))] });
    const lai = PMNode.fromJSON(schema, noi);
    expect(splitDoc(lai, [lai.child(0).nodeSize])).toEqual(cu);
  });

  it("cat giua muc danh sach: muc, doan va danh sach noi lai nhu goc", () => {
    const doc = PMNode.fromJSON(schema, { type: "doc", content: [{ type: "bulletList", content: [li("một hai"), li("ba")] }] });
    const cu = cachCu(splitDoc(doc, [3 + "một ".length]));
    expect(JSON.stringify(cu[1])).toContain("noiTiep");
    expect(joinSheets(cu)).toEqual(doc.toJSON());
  });

  it("cat ngay sau Shift+Enter: noi thanh mot doan", () => {
    const tho = PMNode.fromJSON(schema, { type: "doc", content: [p(t("Dòng một"), { type: "hardBreak" }, t("dòng hai"))] });
    const cu = cachCu(splitDoc(tho, [1 + "Dòng một".length + 1]));
    expect(JSON.stringify(cu)).not.toContain("noiTiep");
    expect(joinSheets(cu)).toEqual(tho.toJSON());
  });

  it("mot to: tra lai ban sao cua chinh to do", () => {
    const mot: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Một" }] }] };
    expect(joinSheets([mot])).toEqual(mot);
  });
});

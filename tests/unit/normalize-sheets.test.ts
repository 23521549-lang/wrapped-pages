import { describe, expect, it } from "vitest";
import { normalizeSheets } from "@/lib/doc/continuation";
import type { DocJson } from "@/lib/doc/types";

const doan = (text: string, noiTiep = false) =>
  noiTiep ? { type: "paragraph" as const, noiTiep: true as const, content: [{ type: "text" as const, text }] } : { type: "paragraph" as const, content: [{ type: "text" as const, text }] };

describe("normalizeSheets", () => {
  it("to dau khong giu dau nao; to sau giu dau tren nhanh dau, bo dau o cho khac", () => {
    const dau: DocJson = { type: "doc", content: [doan("a", true)] };
    const sau: DocJson = {
      type: "doc",
      content: [
        { type: "bulletList", noiTiep: true, content: [{ type: "listItem", noiTiep: true, content: [doan("b", true)] }, { type: "listItem", noiTiep: true, content: [doan("c")] }] },
        doan("d", true),
      ],
    };
    expect(normalizeSheets([dau, sau])).toEqual([
      { type: "doc", content: [doan("a")] },
      {
        type: "doc",
        content: [
          { type: "bulletList", noiTiep: true, content: [{ type: "listItem", noiTiep: true, content: [doan("b", true)] }, { type: "listItem", content: [doan("c")] }] },
          doan("d"),
        ],
      },
    ]);
  });

  it("giu dau false tren khoi dau cua to sau; bo dau false o to dau va o cho khac", () => {
    const voi = (noiTiep: boolean) => ({ type: "paragraph" as const, noiTiep, content: [{ type: "text" as const, text: "x" }] });
    const to: DocJson[] = [
      { type: "doc", content: [voi(false)] },
      { type: "doc", content: [voi(false), voi(false)] },
      { type: "doc", content: [{ type: "blockquote", noiTiep: false, content: [voi(false)] }] },
    ];
    expect(normalizeSheets(to)).toEqual([
      { type: "doc", content: [doan("x")] },
      { type: "doc", content: [voi(false), doan("x")] },
      { type: "doc", content: [{ type: "blockquote", noiTiep: false, content: [doan("x")] }] },
    ]);
  });

  it("khong doi dau vao, khong them dau o cho chua co", () => {
    const to: DocJson[] = [{ type: "doc", content: [doan("a")] }, { type: "doc", content: [doan("b")] }];
    const truoc = JSON.stringify(to);
    expect(normalizeSheets(to)).toEqual(to);
    expect(JSON.stringify(to)).toBe(truoc);
  });
});

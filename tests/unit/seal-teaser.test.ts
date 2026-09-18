import { describe, it, expect } from "vitest";
import { sealTeaser } from "@/lib/seal/teaser";
import { SEAL_LIMITS } from "@/lib/seal/types";
import type { DocJson } from "@/lib/doc/types";

const doc = (...doan: string[]): DocJson => ({
  type: "doc",
  content: doan.map((chu) =>
    chu === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text: chu }] },
  ),
});

describe("sealTeaser", () => {
  it("lay dong co chu dau tien, bo cac doan trong o dau", () => {
    expect(sealTeaser(doc("", "   ", "Hôm nay mưa.", "Dòng thứ hai"))).toBe("Hôm nay mưa.");
  });

  it("chi lay toi xuong dong mem dau tien trong doan", () => {
    const d: DocJson = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Dòng một" }, { type: "hardBreak" }, { type: "text", text: "Dòng hai" }],
      }],
    };
    expect(sealTeaser(d)).toBe("Dòng một");
  });

  it("dong dau nam trong trich dan van lay duoc", () => {
    const d: DocJson = {
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Trích dẫn" }] }] }],
    };
    expect(sealTeaser(d)).toBe("Trích dẫn");
  });

  it("dong dai bi cat o ranh gioi tu, khong qua tran, co dau ba cham", () => {
    const dai = "Em tới sớm hơn giờ hẹn bốn mươi phút, ngồi ở cái ghế nhựa xanh gần quầy vé và đếm từng chiếc xe khách chạy vào bến";
    const t = sealTeaser(doc(dai));
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(SEAL_LIMITS.teaserMax + 1);
    expect(dai.startsWith(t.slice(0, -1))).toBe(true);
  });

  it("to khong co chu nao thi tra chuoi rong", () => {
    expect(sealTeaser(doc("", " "))).toBe("");
  });

  it("dong dau la mot tu dai khong co khoang trang thi cat cung, vua dung tran cot he lo", () => {
    const t = sealTeaser(doc("x".repeat(300)));
    expect(t).toBe(`${"x".repeat(SEAL_LIMITS.teaserMax)}…`);
    expect(t.length).toBe(SEAL_LIMITS.teaserMax + 1);
  });
});

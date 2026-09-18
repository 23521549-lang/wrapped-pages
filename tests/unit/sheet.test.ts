import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CONTENT_HEIGHT, CONTENT_WIDTH, SHEET, spacerHeight, VOICE_BLOCK_HEIGHT } from "@/lib/sheet";

describe("hinh hoc to giay", () => {
  it("vung chu la 304 x 460", () => {
    expect([CONTENT_WIDTH, CONTENT_HEIGHT]).toEqual([304, 460]);
  });

  it("tokens.css khai dung tung kich thuoc cua src/lib/sheet.ts", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    const want: Record<string, number> = {
      "giay-w": SHEET.width, "giay-h": SHEET.height,
      "giay-pt": SHEET.padTop, "giay-pr": SHEET.padRight, "giay-pb": SHEET.padBottom, "giay-pl": SHEET.padLeft,
      "giay-khe": SHEET.gap, "khoi-ghi-am-h": VOICE_BLOCK_HEIGHT,
    };
    for (const [name, px] of Object.entries(want)) expect(css, name).toContain(`--${name}: ${px}px;`);
  });

  it("khoi dem day phan con lai qua day to, khe va dau to sau", () => {
    expect(spacerHeight(33)).toBe(33 + 44 + 28 + 36);
    expect(spacerHeight(-10)).toBe(44 + 28 + 36);
  });
});

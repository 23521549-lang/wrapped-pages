import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles/tokens.css", "utf8");

describe("tokens.css", () => {
  it("khai bao du bien mau bat buoc", () => {
    for (const name of [
      "--color-paper", "--color-ink", "--blue-1", "--blue-2", "--blue-3",
      "--blue-ink", "--blue-mark", "--blue-line",
      "--color-rule", "--color-rule-ui", "--color-focus",
    ]) {
      expect(css, `thieu bien ${name}`).toContain(name);
    }
  });

  it("khong dung mau tuyet doi trang hoac den o bat ky dang viet nao", () => {
    expect(css, "dung hex trang hoac den").not.toMatch(/#(fff|ffffff|000|000000)\b/i);
    expect(css, "dung tu khoa white hoac black").not.toMatch(/:\s*(white|black)\s*[;}]/i);
    expect(css, "dung rgb trang hoac den").not.toMatch(/rgba?\(\s*(255[\s,]+255[\s,]+255|0[\s,]+0[\s,]+0)\s*[),]/);
  });

  it("moi mau oklch deu mang mot chut chroma, khong bao gio bang 0", () => {
    const found = [...css.matchAll(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/g)];
    expect(found.length, "khong tim thay mau oklch nao").toBeGreaterThan(0);
    for (const m of found) {
      expect(Number(m[2]), `chroma bang 0 o ${m[0]}`).toBeGreaterThan(0);
    }
  });
});

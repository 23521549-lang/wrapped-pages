import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LockedSheet } from "@/components/reader/LockedSheet";

const html = (teaser: string | null, index = 0) => renderToStaticMarkup(createElement(LockedSheet, { teaser, index }));
const chu = (s: string) => s.replace(/<[^>]*>/g, "");

describe("LockedSheet", () => {
  it("chu duy nhat la dau niem phong, dong he lo va cau cho trinh doc man hinh", () => {
    expect(chu(html("Em tới sớm."))).toBe("Đang niêm phongEm tới sớm.Phần còn lại của trang đang niêm phong.");
    expect(chu(html(null))).toBe("Đang niêm phongTrang đang niêm phong.");
  });

  it("vach nhoe an voi trinh doc man hinh va chi la the rong", () => {
    const out = html("Em tới sớm.");
    expect(out).toContain('<div class="nhoe" aria-hidden="true">');
    expect(out.match(/class="nhoe__dong"/g)).toHaveLength(12);
    expect(out).not.toMatch(/class="nhoe__dong"[^>]*>[^<]/);
  });

  it("dong he lo la chu, duoc React thoat", () => {
    expect(html("<b>x</b>")).toContain("<p>&lt;b&gt;x&lt;/b&gt;</p>");
  });
});

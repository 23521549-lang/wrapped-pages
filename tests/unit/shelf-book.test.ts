import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShelfBook, type ShelfBookProps } from "@/components/book/ShelfBook";
import { OpenBook, type OpenBookProps } from "@/components/book/OpenBook";

const CUON: ShelfBookProps = {
  title: "Chuyện chưa kể", href: "/sach/abc", cover: "nui-xa", coverMediaId: null,
  pageCount: 3, when: "hôm qua", newCount: 0, lockedCount: 0, isPrivate: false,
};
const cuon = (p: Partial<ShelfBookProps> = {}) => renderToStaticMarkup(createElement(ShelfBook, { ...CUON, ...p }));
const chu = (html: string) => html.replace(/<[^>]*>/g, "");

describe("ShelfBook", () => {
  it("ca cuon la mot lien ket toi man doc; dong phu dung dau phay", () => {
    const html = cuon();
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toMatch(/^<li class="cuon"><a class="cuon__lien" href="\/sach\/abc">/);
    expect(chu(html)).toBe("Chuyện chưa kể3 trang, hôm qua");
    expect(chu(cuon({ pageCount: 0 }))).toBe("Chuyện chưa kểChưa có trang, hôm qua");
  });

  it("dau hieu la chu kem ky hieu, dung thu tu moi, khoa, rieng tu; khong co chip", () => {
    const html = cuon({ newCount: 2, lockedCount: 1, isPrivate: true });
    expect(chu(html)).toContain("2 trang mới1 trang khóaRiêng tư");
    expect(html).not.toContain("chip");
    expect(html).toContain('<span class="cham" aria-hidden="true">');
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
  });

  it("khong co dau hieu thi khong co dong dau hieu", () => {
    expect(cuon()).not.toContain("dau-hieu");
  });
});

const MO: OpenBookProps = {
  who: "Linh", title: "Chuyện chưa kể", cover: "trang-nuoc", coverMediaId: null, pageCount: 4, lastPosition: 4,
  when: "vừa xong", excerpt: "Dòng chữ thật", locked: false, isPrivate: false, action: { label: "Đọc tiếp", href: "/sach/abc" },
};
const mo = (p: Partial<OpenBookProps> = {}) => renderToStaticMarkup(createElement(OpenBook, { ...MO, ...p }));

describe("OpenBook", () => {
  it("trang trai co ai viet, ten, dong phu va mot nut chinh; trang phai la doan trich va so trang", () => {
    const html = mo();
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('<a class="btn sach-mo__nut" href="/sach/abc">Đọc tiếp</a>');
    expect(chu(html)).toContain("Linh vừa viết");
    expect(html).toContain('<p class="vua-viet__chu">Dòng chữ thật</p>');
    expect(html).toContain('<span class="sach-mo__so" aria-hidden="true">4</span>');
  });

  it("to cuoi khoa: chi dong he lo, vach nhoe rong va nhan khoa; khong co doan trich lam mo", () => {
    const html = mo({ locked: true, excerpt: "Dòng hé lộ" });
    expect(html).toContain('<p class="he-lo">Dòng hé lộ</p>');
    expect(html).toContain('<div class="nhoe" aria-hidden="true">');
    expect(html).not.toMatch(/class="nhoe__dong"[^>]*>[^<]/);
    expect(chu(html)).toContain("Trang khóa, vượt thử thách để đọc");
    expect(html).not.toContain("vua-viet__chu");
    expect(chu(mo({ locked: true, excerpt: null }))).not.toContain("hé lộ");
  });

  it("rieng tu: doan trich lam mo va an voi trinh doc man hinh, nhan Rieng tu de len", () => {
    const html = mo({ isPrivate: true, who: "Bạn", action: { label: "Viết tiếp", href: "/sach/abc/viet" } });
    expect(html).toContain('<p class="vua-viet__chu vua-viet__chu--mo" aria-hidden="true">Dòng chữ thật</p>');
    expect(chu(html)).toContain("Riêng tưMở sách để đọc");
  });
});

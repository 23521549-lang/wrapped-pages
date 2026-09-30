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
  who: "Linh", title: "Chuyện chưa kể", covers: [{ cover: "trang-nuoc", coverMediaId: null }], tuDatNut: false, dauHref: "/dau-thoi-gian/abc", pageCount: 4, position: 4,
  readHref: "/sach/abc?trang=4",
  when: "vừa xong", excerpt: "Dòng chữ thật", locked: false, isPrivate: false, action: { label: "Đọc tiếp", href: "/sach/abc" },
};
const mo = (p: Partial<OpenBookProps> = {}) => renderToStaticMarkup(createElement(OpenBook, { ...MO, ...p }));

describe("OpenBook", () => {
  it("trang trai co ai viet, ten, dong phu va mot nut chinh; trang phai la doan trich va so trang", () => {
    const html = mo();
    expect(html).toContain('<article class="vua-viet" aria-label="Một trang trong sách">');
    // Ba lien ket: lop phu toi man doc, anh bia toi trang Dau thoi gian, va nut chinh. Spec 11.1: "Bấm ảnh bìa trên
    // khung sách lớn ở Kệ sách ... bìa phải là một liên kết riêng, nằm ngoài lớp phủ trong DOM và nằm trên nó theo thứ
    // tự lớp". Khang dinh ngay duoi (khong lien ket nao nam trong lien ket nao) van giu nguyen.
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain('<a class="tranh-dan__lien" href="/dau-thoi-gian/abc">');
    // Link phu khung dung dau, chi chua chu an; nut chinh la link rieng, khong link nao nam trong link nao.
    expect(html).toContain('<div class="sach-mo"><a class="sach-mo__lien" href="/sach/abc?trang=4"><span class="sr-only">Đọc Chuyện chưa kể tại trang 4</span></a>');
    expect(html).toContain('<a class="btn sach-mo__nut" href="/sach/abc">Đọc tiếp</a>');
    expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>).)*<a /);
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

  it("dong he lo khong phai chu cua to position: khong in so trang, nhan lien ket noi noi man doc bat dau", () => {
    // Khong to doc duoc nao co chu: to position (vd to 1 chi co anh) khac to khoa mang dong he lo.
    const html = mo({ locked: true, excerpt: "Dòng hé lộ", position: 1, readHref: "/sach/abc?trang=1" });
    expect(html).not.toContain("sach-mo__so");
    expect(html).toContain('<a class="sach-mo__lien" href="/sach/abc?trang=1"><span class="sr-only">Đọc Chuyện chưa kể từ trang 1</span></a>');
  });

  it("rieng tu: doan trich lam mo va an voi trinh doc man hinh, nhan Rieng tu de len", () => {
    const html = mo({ isPrivate: true, who: "Bạn", action: { label: "Viết tiếp", href: "/sach/abc/viet" } });
    expect(html).toContain('<p class="vua-viet__chu vua-viet__chu--mo" aria-hidden="true">Dòng chữ thật</p>');
    expect(chu(html)).toContain("Riêng tưMở sách để đọc");
  });

  it("luot chua doc: nhan cham dac 'Bạn chưa đọc' hay cham rong '{tên} chưa đọc', dong dem, sau dong phu", () => {
    const html = mo({ nhan: { chu: "Bạn chưa đọc", dac: true }, dem: "Lượt chưa đọc 1 / 4" });
    expect(html).toContain('<p class="vua-viet__phu">4 trang, vừa xong</p><p class="dau-hieu vua-viet__nhan"><span class="dh dh--moi"><span class="cham" aria-hidden="true"></span>Bạn chưa đọc</span></p><p class="vua-viet__dem">Lượt chưa đọc 1 / 4</p>');
    const rong = mo({ nhan: { chu: "Linh chưa đọc", dac: false } });
    expect(rong).toContain('<p class="dau-hieu vua-viet__nhan"><span class="dh"><span class="cham cham--rong" aria-hidden="true"></span>Linh chưa đọc</span></p>');
    expect(rong).not.toContain("vua-viet__dem");
    expect(mo()).not.toContain("vua-viet__nhan");
    // Co nhan thi khung doi sang bo cuc luot chua doc (tranh dan co lai vua cho con trong); khong co thi nhu cu.
    expect(rong).toContain('<div class="sach-mo sach-mo--luot">');
    expect(mo()).toContain('<div class="sach-mo">');
  });

  it("khung luan phien: chu trang phai thay duoc (dang go), lop dang-doi, va nut tam dung theo kieu", () => {
    const html = mo({ chuPhai: createElement("span", { className: "dang-go" }, "Dòng"), dangDoi: true, nutLuanPhien: "luon" });
    expect(html).toContain('<p class="vua-viet__chu"><span class="dang-go">Dòng</span></p>');
    expect(html).toContain('<div class="sach-mo dang-doi">');
    expect(html).toContain('class="btn btn--chu bia-dung bia-dung--luon"');
    expect(mo({ nutLuanPhien: "giam" })).toContain('class="btn btn--chu bia-dung bia-dung--giam"');
    const khoa = mo({ locked: true, excerpt: "Dòng hé lộ", chuPhai: createElement("span", null, "Dòng") });
    expect(khoa).toContain('<p class="he-lo"><span>Dòng</span></p>');
    // Mac dinh: mot bia va khong tu dat nut thi khong co nut; khong dang doi thi khong co lop.
    expect(mo()).not.toContain("bia-dung");
    expect(mo()).toContain('<div class="sach-mo">');
  });
});

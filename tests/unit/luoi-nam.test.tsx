// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { vi } from "vitest";
import { LuoiNam, type DauHien, type ThangHien } from "@/components/dau-thoi-gian/LuoiNam";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/*
 * Trang Dau thoi gian: luoi muoi hai thang cua mot nam va khung chi tiet, dung tinh than Lich hoa. Diem 15 cua chu du
 * an: "BO CUC C (luoi muoi hai thang + khung chi tiet, giong Lich hoa)".
 */

const CR = String.fromCharCode(13);
const CSS = readFileSync("src/styles/app.css", "utf8").split(CR).join("");

const moDau: DauHien = { key: "b0", loai: "bia", nhan: "Lúc tạo sách", ngay: "18.03", docHref: "/sach/s1", docNhan: "Đọc từ đầu", cover: "nui-xa", coverMediaId: null };
const bia3: DauHien = { key: "b3", loai: "bia", nhan: "Lượt 3, trang 12 tới 17", ngay: "20.09", docHref: "/sach/s1?trang=12", docNhan: "Đọc từ trang 12", cover: "hoa-dao", coverMediaId: "anh-1" };
const nhac3: DauHien = { key: "n3", loai: "nhac", nhan: "Lượt 3, trang 12 tới 17", ngay: "20.09", docHref: "/sach/s1?trang=12", docNhan: "Đọc từ trang 12", go: false };
const go4: DauHien = { key: "n4", loai: "nhac", nhan: "Lượt 4, trang 18", ngay: "22.09", docHref: "/sach/s1?trang=18", docNhan: "Đọc từ trang 18", go: true };

function thang(dau: Partial<Record<number, DauHien[]>>): ThangHien[] {
  return Array.from({ length: 12 }, (_, i) => ({ thang: i + 1, dau: dau[i + 1] ?? [] }));
}

function ve(props: Partial<Parameters<typeof LuoiNam>[0]> = {}) {
  render(
    <LuoiNam
      nam={2026}
      oThang={thang({ 3: [moDau], 9: [bia3, nhac3, go4] })}
      chonDau={9}
      namTruocHref="/dau-thoi-gian/s1?nam=2025"
      namSauHref={null}
      {...props}
    />,
  );
}

const oThang = () => [...document.querySelectorAll<HTMLButtonElement>(".nam-o")];
const chiTiet = () => document.querySelector(".chi-tiet") as HTMLElement;

afterEach(cleanup);

describe("LuoiNam", () => {
  it("luon du muoi hai o thang; thang khong co dau nao chi con ten thang nhat", () => {
    ve();
    expect(oThang()).toHaveLength(12);
    expect(oThang()[0].classList.contains("nam-o--trong")).toBe(true);
    expect(oThang()[8].classList.contains("nam-o--trong")).toBe(false);
  });

  it("moi o bia la mot con tem, moi o nhac la mot not, o go nhac la not gach cheo", () => {
    ve();
    const o9 = oThang()[8];
    expect(o9.querySelectorAll(".nam-tem")).toHaveLength(1);
    expect(o9.querySelectorAll(".nam-not")).toHaveLength(2);
    // Not gach cheo co them mot duong thang cheo: ba duong ve thay vi hai.
    const soNet = [...o9.querySelectorAll(".nam-not svg")].map((s) => s.querySelectorAll("path").length);
    expect(soNet).toEqual([1, 2]);
  });

  it("khung chi tiet ke dung thang dang chon, moi dau mot dong, theo thu tu da gom", () => {
    ve();
    expect(chiTiet().querySelector("h2")?.textContent).toBe("Tháng 9, 2026");
    const dong = [...chiTiet().querySelectorAll(".dtg-ct__dong")];
    expect(dong).toHaveLength(3);
    expect(dong[0].textContent).toContain("Lượt 3, trang 12 tới 17");
    expect(dong[1].textContent).toContain("Nhạc nền, lượt 3");
    expect(dong[2].textContent).toContain("Gỡ nhạc nền, lượt 4");
  });

  it("bam mot thang thi khung chi tiet doi tai cho, o do duoc danh dau", () => {
    ve();
    fireEvent.click(oThang()[2]);
    expect(oThang()[2].getAttribute("aria-pressed")).toBe("true");
    expect(oThang()[8].getAttribute("aria-pressed")).toBe("false");
    expect(chiTiet().querySelector("h2")?.textContent).toBe("Tháng 3, 2026");
    expect(chiTiet().textContent).toContain("Lúc tạo sách");
  });

  it("thang trong: khung chi tiet noi ro thang nay chua co dau nao", () => {
    ve();
    fireEvent.click(oThang()[0]);
    expect(chiTiet().textContent).toContain("Tháng này chưa có dấu nào.");
  });

  it("ca nam trong: khong thang nao duoc chon san", () => {
    ve({ oThang: thang({}), chonDau: null });
    expect(oThang().every((o) => o.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(chiTiet().textContent).toContain("Năm này chưa có dấu nào.");
  });

  it("moi dong co lien ket doc tro dung to dau cua luot; o mo dau doc tu dau", () => {
    ve();
    const lien = [...chiTiet().querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(lien).toEqual(["/sach/s1?trang=12", "/sach/s1?trang=12", "/sach/s1?trang=18"]);
    fireEvent.click(oThang()[2]);
    expect(chiTiet().querySelector("a")?.getAttribute("href")).toBe("/sach/s1");
  });

  it("khong mot lien ket nao ra ngoai web: o nhac dan ve man doc, khong mo YouTube", () => {
    ve();
    for (const a of document.querySelectorAll("a")) expect(a.getAttribute("href")?.startsWith("/")).toBe(true);
  });

  it("khung chi tiet la mot vung aria-live=polite", () => {
    ve();
    expect(chiTiet().getAttribute("aria-live")).toBe("polite");
  });

  it("doi nam bang lien ket that; nam hien tai thi nut Nam sau tat", () => {
    ve();
    expect(screen.getByRole("link", { name: "Năm trước" }).getAttribute("href")).toBe("/dau-thoi-gian/s1?nam=2025");
    expect((screen.getByRole("button", { name: "Năm sau" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("nam som nhat: nut Nam truoc tat", () => {
    ve({ namTruocHref: null, namSauHref: "/dau-thoi-gian/s1?nam=2027" });
    expect((screen.getByRole("button", { name: "Năm trước" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "Năm sau" })).toBeTruthy();
  });

  it("moi o thang co ten doc duoc noi so bia va so dau nhac", () => {
    ve();
    expect(screen.getByRole("button", { name: "Tháng 9: 1 bìa, 2 dấu nhạc" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tháng 1: chưa có dấu nào" })).toBeTruthy();
  });
});

describe("luoi nam trong app.css", () => {
  it("3 cot o man hep, 4 cot tu 768px", () => {
    expect(CSS).toContain(".nam-luoi{ border: 0; margin: 0; padding: 0; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(CSS).toContain("@media (min-width: 768px){ .nam-luoi{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }");
  });

  it("khong mot hoat anh nao tren trang nay", () => {
    const i = CSS.indexOf(".nam-luoi{");
    const j = CSS.indexOf(".dtg-ct__doc{");
    const khoi = CSS.slice(i, CSS.indexOf("}", j));
    expect(khoi).not.toContain("transition");
    expect(khoi).not.toContain("animation");
  });

  it("tem bia co khung co dinh 5:3, anh ve muon khong day luoi", () => {
    const i = CSS.indexOf(".nam-tem{");
    const than = CSS.slice(i, CSS.indexOf("}", i));
    expect(than).toContain("aspect-ratio: 5 / 3");
    expect(than).toContain("height: 26px");
  });

  it("o thang cao toi thieu 64px, vung bam du rong o man hep", () => {
    const i = CSS.indexOf(".nam-o{");
    expect(CSS.slice(i, CSS.indexOf("}", i))).toContain("min-height: 64px");
  });
});

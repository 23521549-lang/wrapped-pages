import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { gomTheoLuot, LichDau, moTaLuot, type DauHien } from "@/components/dau-thoi-gian/LichDau";
import { luoiThang } from "@/lib/tam-trang/lich";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/*
 * Trang Dau thoi gian: lich thang cua mot cuon, cung khung voi Lich hoa (spec bo sung B4, chu du an 26/09: "doi lai giao
 * dien lich dep nhu lich hoa"). Moi ngay mot o voi hai lan: lan tren la bia, lan duoi la nhac.
 */

const CR = String.fromCharCode(13);
const CSS = readFileSync("src/styles/app.css", "utf8").split(CR).join("");

const THANG = { y: 2026, m: 9 };
/** 12 gio trua 26.09.2026 gio Viet Nam. */
const NOW = new Date(Date.UTC(2026, 8, 26, 5));

const moDau: DauHien = { key: "b0", luot: "mo-dau", loai: "bia", nhan: "Lúc tạo sách", gio: "08:00", docHref: "/sach/s1", docNhan: "Đọc từ đầu", cover: "nui-xa", coverMediaId: null };
const bia2: DauHien = { key: "b2", luot: "luot-2", loai: "bia", nhan: "Lượt 2, trang 2", gio: "08:10", docHref: "/sach/s1?trang=2", docNhan: "Đọc từ trang 2", cover: "chim-bay", coverMediaId: null };
const nhac2: DauHien = { key: "n2", luot: "luot-2", loai: "nhac", nhan: "Lượt 2, trang 2", gio: "08:10", docHref: "/sach/s1?trang=2", docNhan: "Đọc từ trang 2", go: false };
const bia3: DauHien = { key: "b3", luot: "luot-3", loai: "bia", nhan: "Lượt 3, trang 3", gio: "19:45", docHref: "/sach/s1?trang=3", docNhan: "Đọc từ trang 3", cover: "thuyen-trang", coverMediaId: "anh-1" };
const go3: DauHien = { key: "n3", luot: "luot-3", loai: "nhac", nhan: "Lượt 3, trang 3", gio: "19:45", docHref: "/sach/s1?trang=3", docNhan: "Đọc từ trang 3", go: true };

function ve(props: Partial<Parameters<typeof LichDau>[0]> = {}) {
  render(
    <LichDau
      thang={THANG}
      tuan={luoiThang(THANG, 26)}
      ngay={{ 3: [moDau], 15: [bia2, nhac2, bia3, go3] }}
      chonDau={15}
      now={NOW}
      truocHref="/dau-thoi-gian/s1?thang=2026-08"
      sauHref={null}
      {...props}
    />,
  );
}

const oNgay = (so: number) => screen.getByRole("button", { name: new RegExp(`^${so} tháng 9\\.`) });
const chiTiet = () => document.querySelector(".chi-tiet") as HTMLElement;

afterEach(cleanup);

describe("gomTheoLuot va moTaLuot", () => {
  it("bia va nhac cua cung mot luot gop thanh mot nhom, giu thu tu dong thoi gian", () => {
    const nhom = gomTheoLuot([bia2, nhac2, bia3, go3]);
    expect(nhom.map((n) => [n.key, n.bia?.key ?? null, n.nhac?.key ?? null])).toEqual([["luot-2", "b2", "n2"], ["luot-3", "b3", "n3"]]);
  });

  it("mo ta dung thu luot da doi", () => {
    const [l2, l3] = gomTheoLuot([bia2, nhac2, bia3, go3]);
    expect(moTaLuot(l2)).toBe("Bìa mới, nhạc mới");
    expect(moTaLuot(l3)).toBe("Bìa mới, gỡ nhạc");
    expect(moTaLuot(gomTheoLuot([nhac2])[0])).toBe("Nhạc mới");
    expect(moTaLuot(gomTheoLuot([moDau])[0])).toBe("Bìa mới");
  });
});

describe("LichDau", () => {
  it("moi ngay da qua la mot o bam duoc; ngay sau hom nay mo va khong bam duoc, nhu Lich hoa", () => {
    ve();
    expect(screen.getAllByRole("button", { name: /^[0-9]+ tháng 9\./ })).toHaveLength(26);
    expect(document.querySelectorAll(".ngay--xa")).toHaveLength(4);
    expect(oNgay(26).className).toContain("ngay--nay");
  });

  it("lan tren la bia, lan duoi la nhac; ngay khong co dau la hai vong cham mo", () => {
    ve();
    const ngay3 = oNgay(3);
    expect(ngay3.querySelector(".dtg-tem.bia--nui-xa")).not.toBeNull();
    expect(ngay3.querySelectorAll(".hoa-trong")).toHaveLength(1);
    expect(oNgay(4).querySelectorAll(".hoa-trong")).toHaveLength(2);
  });

  it("nhieu dau cung loai trong mot ngay: tem bia cuoi cung xep chong va mot con so; mot dau thi khong co so", () => {
    ve();
    const ngay15 = oNgay(15);
    const tem = ngay15.querySelector(".dtg-tem") as HTMLElement;
    expect(tem.className).toContain("dtg-tem--chong");
    expect(tem.className).toContain("bia--thuyen-trang");
    expect([...ngay15.querySelectorAll(".dtg-dem")].map((d) => d.textContent)).toEqual(["2", "2"]);
    // Nhac cuoi cung trong ngay la go nhac: not gach cheo.
    expect(ngay15.querySelector(".dtg-not svg path:last-child")?.getAttribute("d")).toBe("M1.5 10.5L10.5 1.5");
    expect(oNgay(3).querySelector(".dtg-dem")).toBeNull();
    expect(oNgay(3).querySelector(".dtg-tem--chong")).toBeNull();
  });

  it("khung chi tiet gom theo luot: moi luot mot dong va mot lien ket doc, khong lap lai cho doc", () => {
    ve();
    const dong = [...chiTiet().querySelectorAll(".dtg-ct__dong")];
    expect(dong).toHaveLength(2);
    expect(dong.map((d) => d.querySelector(".dtg-ct__chu")?.textContent)).toEqual([
      "Lượt 2, trang 2Bìa mới, nhạc mới, 08:10",
      "Lượt 3, trang 3Bìa mới, gỡ nhạc, 19:45",
    ]);
    expect(dong.map((d) => d.querySelector("a")?.getAttribute("href"))).toEqual(["/sach/s1?trang=2", "/sach/s1?trang=3"]);
    expect(screen.getByRole("heading", { level: 2, name: "Thứ Ba, 15.09" })).toBeTruthy();
  });

  it("nhan doc cua o ngay ke du tung luot; so dem an voi trinh doc man hinh", () => {
    ve();
    expect(oNgay(15).getAttribute("aria-label")).toBe("15 tháng 9. Lượt 2, trang 2: bìa mới, nhạc mới. Lượt 3, trang 3: bìa mới, gỡ nhạc");
    expect(oNgay(26).getAttribute("aria-label")).toBe("26 tháng 9. Không có dấu nào. Hôm nay");
    for (const d of oNgay(15).querySelectorAll(".dtg-dem")) expect(d.getAttribute("aria-hidden")).toBe("true");
  });

  it("bam mot ngay: khung chi tiet doi tai cho, ngay do duoc danh dau; ngay khong co dau thi noi ro", () => {
    ve();
    expect(oNgay(15).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(oNgay(3));
    expect(oNgay(3).getAttribute("aria-pressed")).toBe("true");
    expect(oNgay(15).getAttribute("aria-pressed")).toBe("false");
    expect(chiTiet().querySelector(".dtg-ct__chu")?.textContent).toBe("Lúc tạo sáchBìa mới, 08:00");
    expect(chiTiet().querySelector("a")?.getAttribute("href")).toBe("/sach/s1");
    fireEvent.click(oNgay(4));
    expect(chiTiet().textContent).toContain("Ngày này không có dấu nào.");
  });

  it("khung chi tiet la mot vung aria-live=polite; moi lien ket o lai trong web", () => {
    ve();
    expect(chiTiet().getAttribute("aria-live")).toBe("polite");
    for (const a of document.querySelectorAll("a")) expect(a.getAttribute("href")?.startsWith("/")).toBe(true);
  });

  it("doi thang bang lien ket that; thang nay thi nut Thang sau tat; thang tao sach thi nut Thang truoc tat", () => {
    ve();
    expect(screen.getByRole("link", { name: "Tháng trước" }).getAttribute("href")).toBe("/dau-thoi-gian/s1?thang=2026-08");
    expect((screen.getByRole("button", { name: "Tháng sau" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    ve({ truocHref: null, sauHref: "/dau-thoi-gian/s1?thang=2026-10" });
    expect((screen.getByRole("button", { name: "Tháng trước" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "Tháng sau" }).getAttribute("href")).toBe("/dau-thoi-gian/s1?thang=2026-10");
  });

  it("dong tong cua thang dem dung so bia va so dau nhac", () => {
    ve();
    expect(document.querySelector(".thang__tong")?.textContent).toBe("3 bìa, 2 dấu nhạc trong tháng");
  });
});

describe("lich Dau thoi gian trong app.css", () => {
  it("tem bia trong lan giu ti le 5:3 va khong rong qua o ngay", () => {
    const i = CSS.indexOf(".ngay .dtg-tem{");
    const than = CSS.slice(i, CSS.indexOf("}", i));
    expect(than).toContain("aspect-ratio: 5 / 3");
    expect(than).toContain("width: min(calc(var(--hoa-w) * 1.25), 100%)");
  });

  it("khong mot hoat anh nao tren lich nay", () => {
    const i = CSS.indexOf(".ngay .dtg-tem{");
    const j = CSS.indexOf(".dtg-ct__doc{");
    const khoi = CSS.slice(i, CSS.indexOf("}", j));
    expect(khoi).not.toContain("transition");
    expect(khoi).not.toContain("animation");
  });

  it("khong con quy tac nao cua luoi muoi hai thang cu", () => {
    expect(CSS).not.toContain(".nam-luoi");
    expect(CSS).not.toContain(".nam-o");
  });
});

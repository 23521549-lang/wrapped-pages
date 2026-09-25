// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CoverPicker, type CoverPhotoView } from "@/components/book/CoverPicker";
import type { CoverKey } from "@/lib/book";

// Bang bia nhap action tai len; mo dun that keo theo @/server (server-only) nen khong nap duoc trong bai kiem DOM.
// Tep nay khong tai anh nao len, ham gia chi de cay nhap dung duoc.
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn(async () => ({ error: "khong dung toi" })) }));

/*
 * Bang bia nam trong mot vung cuon an thanh cuon. Dai mo o day khong dung IntersectionObserver ma dung dung co che CSS
 * cua cot Hoat dong: mot phan tu dinh o mep duoi keo nguoc len bang chinh chieu cao cua no, cong mot khoang dem duoi
 * bang chung ay o luoi o. Cuon toi day thi dai mo nam tron tren khoang trong nen khong con nhin thay.
 * Khong mot dong script nao chay theo vi tri cuon: khong nghe su kien scroll, khong doc bo cuc luc cuon, khong observer
 * nao phai nho don. Tep nay la cong giu ca hai dieu do.
 */

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const CSS = readFileSync("src/styles/app.css", "utf8").split(CR).join("");
const NGUON = readFileSync("src/components/book/CoverPicker.tsx", "utf8");

/** Khai bao cua quy tac dau tien viet dung bo chon nay trong css, khoang trang da gop lai. */
function khai(chon: string): string {
  const bat = [`${chon}{`, `${chon} {`].map((m) => CSS.indexOf(m)).find((i) => i >= 0);
  expect(bat, `khong co quy tac ${chon}`).toBeDefined();
  const mo = CSS.indexOf("{", bat) + 1;
  return CSS.slice(mo, CSS.indexOf("}", mo)).split(LF).join(" ").replace(/ +/g, " ");
}

const KHO: CoverPhotoView[] = [
  { id: "1111aaaa-1111-4111-8111-111111111111", nhan: "Ảnh của bạn, tải 21.09" },
  { id: "2222bbbb-2222-4222-8222-222222222222", nhan: "Ảnh của bạn, tải 20.09" },
];

function bang(value: { cover: CoverKey | null; photoId: string | null } = { cover: "nui-xa", photoId: null }, onChange = () => {}) {
  render(
    <CoverPicker
      value={value}
      onChange={onChange}
      photos={KHO}
      giuDuoc={false}
      bookId="sach-1"
      mediaEnabled={false}
      disabled={false}
      onBusyChange={() => {}}
    />,
  );
  return document.querySelector<HTMLElement>(".cuon-vung");
}

beforeAll(() => {
  // jsdom khong co scrollIntoView, nen phai dinh nghia truoc thi moi theo doi duoc rang ham do KHONG bi goi.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: () => {}, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("bang bia trong vung cuon", () => {
  it("luoi o nam trong vung cuon", () => {
    const vung = bang();
    expect(vung).not.toBeNull();
    expect(vung?.querySelector(".picker")).not.toBeNull();
  });

  it("bang bia khong co mot dong nao chay theo vi tri cuon", () => {
    // Ngan sach muot cua muc nay: khong nghe su kien scroll, khong doc bo cuc trong luc cuon, khong hoat anh nao chay
    // theo vi tri cuon. Dai mo lam bang CSS thuan (mot phan tu dinh o mep duoi), dung co che cua cot Hoat dong, nen
    // cung khong co observer nao phai nho don khi go component.
    for (const cam of ["onScroll", "IntersectionObserver", "getBoundingClientRect", "ResizeObserver"]) {
      expect(NGUON, `bang bia khong duoc dung ${cam}`).not.toContain(cam);
    }
    expect(NGUON).not.toContain('addEventListener("scroll"');
  });

  it("mo bang thi vung cuon keo o dang chon vao tam nhin bang scrollTop, khong goi scrollIntoView", () => {
    const keo = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    // jsdom tra 0 cho moi kich thuoc, nen dat truoc cac so de phep tinh co gi that de chay.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockReturnValue(480);
    const vung = bang({ cover: null, photoId: KHO[1].id });
    // Khang dinh o that su co truoc khi do: khong co no thi phep tinh duoi la vo nghia.
    expect(vung?.querySelector<HTMLInputElement>("input:checked")?.closest(".swatch")).not.toBeNull();
    expect(vung?.scrollTop).toBe(480 - (300 - 100) / 2);
    expect(keo).not.toHaveBeenCalled();
  });

  it("chua chon o nao thi khong cuon di dau", () => {
    const vung = bang({ cover: null, photoId: null });
    expect(vung?.scrollTop).toBe(0);
  });

  it("o dang chon o ngay dau bang thi khong cuon len am", () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockReturnValue(0);
    const vung = bang();
    expect(vung?.scrollTop).toBe(0);
  });

  it("moi o van nam trong danh sach Tab, khong o nao bi vung cuon lay ra", () => {
    bang();
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="cover"]')];
    expect(radios.length).toBe(12);
    expect(radios.every((r) => r.tabIndex >= 0 && !r.disabled)).toBe(true);
  });

  it("chon mot o trong bang van doi duoc bang chuot va ban phim", () => {
    const onChange = vi.fn();
    bang({ cover: "nui-xa", photoId: null }, onChange);
    fireEvent.click(screen.getByRole("radio", { name: KHO[0].nhan }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("vung cuon trong app.css", () => {
  it("an thanh cuon o ca hai ho trinh duyet, chi cuon doc", () => {
    const vung = khai(".cuon-vung");
    for (const d of ["max-height: 300px", "overflow-y: auto", "overflow-x: hidden", "scrollbar-width: none", "overscroll-behavior: contain"]) {
      expect(vung).toContain(d);
    }
    expect(CSS).toContain(".cuon-vung::-webkit-scrollbar{ display: none; }");
  });

  it("vung cuon la offsetParent cua moi o, nen offsetTop cua o cung he toa do voi scrollTop", () => {
    // Thieu dong nay thi offsetTop cua o tinh tu mot to tien xa hon (ca phan trang phia tren bang bia), va bang mo ra
    // bi cuon qua tay: o dang chon nam khuat phia tren khung. Bai e2e viet-tiep do dieu do tren trinh duyet that.
    expect(khai(".cuon-vung")).toContain("position: relative");
  });

  it("vong focus cua o khong bi vung cuon cat mat", () => {
    // overflow-y: auto cat CA hai chieu, nen phai chua san cho vong focus (outline 2.5px, offset 3px).
    const vung = khai(".cuon-vung");
    expect(vung).toContain("padding: 6px 6px 0");
    expect(vung).toContain("scroll-padding-block: 8px");
  });

  it("dai mo cao dung bang khoang dem duoi cua luoi o, nen cuon toi day thi no vo hinh", () => {
    const sau = khai(".cuon-vung::after");
    const luoi = khai(".cuon-vung .picker");
    const cao = /height: ([0-9.]+rem)/.exec(sau)?.[1];
    const keo = /margin-top: -([0-9.]+rem)/.exec(sau)?.[1];
    const dem = /padding-bottom: ([0-9.]+rem)/.exec(luoi)?.[1];
    expect(cao).toBeDefined();
    expect([keo, dem]).toEqual([cao, cao]);
    expect(sau).toContain("position: sticky");
    expect(sau).toContain("pointer-events: none");
  });
});

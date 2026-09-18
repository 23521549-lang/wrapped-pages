import { describe, it, expect } from "vitest";
import { oklchToSrgb, parseOklch } from "@/lib/mau/oklch";
import { contrastRatio, relativeLuminance } from "@/lib/mau/tuong-phan";
import { docBangToken } from "../helpers/bang-token";

const TRANG = oklchToSrgb(1, 0, 0);
const DEN = oklchToSrgb(0, 0, 0);

describe("oklch sang sRGB", () => {
  it("trang va den ra dung hai dau", () => {
    expect(relativeLuminance(TRANG)).toBeCloseTo(1, 3);
    expect(relativeLuminance(DEN)).toBeCloseTo(0, 6);
  });

  it("doc duoc dang oklch() trong CSS, ke ca khi thua khoang trang", () => {
    expect(parseOklch("oklch(98.5% 0.005 235)")).not.toBeNull();
    expect(parseOklch("oklch( 24%  0.012  250 )")).not.toBeNull();
    expect(parseOklch("var(--color-ink)")).toBeNull();
    expect(parseOklch("#fff")).toBeNull();
  });
});

describe("ty le tuong phan", () => {
  it("trang tren den la 21, va doi cho khong doi ket qua", () => {
    expect(contrastRatio(TRANG, DEN)).toBeCloseTo(21, 1);
    expect(contrastRatio(DEN, TRANG)).toBeCloseTo(21, 1);
  });

  it("mot mau voi chinh no la 1", () => {
    const c = oklchToSrgb(0.62, 0.085, 238);
    expect(contrastRatio(c, c)).toBeCloseTo(1, 6);
  });

  it("moc vang cua phep doi: hai mau oklch co dinh ra dung ty le da tinh doc lap (chi kiem toan hoc, khong phai bang tuong phan)", () => {
    // Hai gia tri co dinh, khong doc tokens.css: neu tokens.css doi thi ca nay KHONG doi, dung vi no chi giu
    // phep doi oklch sang sRGB va cong thuc WCAG khong troi. 24% 0.012 250 tren 98.5% 0.005 235 la 15.758.
    expect(contrastRatio(oklchToSrgb(0.24, 0.012, 250), oklchToSrgb(0.985, 0.005, 235))).toBeCloseTo(15.758, 2);
  });
});

describe("bang tuong phan, doc mau tu tokens.css", () => {
  const bangMau = docBangToken();

  // Tung dong cua bang tuong phan dung thu tu: cap, mau truoc, nen ma cot "Do tren" ghi, ty le trong bang.
  const BANG_9_2: [string, string, string, number][] = [
    ["Chu tren giay", "--color-ink", "--color-paper", 15.76],
    ["Nhan nho tren giay", "--color-ink-3", "--color-paper-3", 5.19],
    ["Chu tren nut", "--blue-ink", "--blue-2", 7.66],
    ["Vien nut so voi nen", "--blue-line", "--blue-2", 3.12],
    ["Vien o nhap", "--color-rule-ui", "--color-paper", 3.34],
    ["Vong focus", "--color-focus", "--color-paper-3", 4.72],
  ];

  it.each(BANG_9_2)("%s: %s tren %s bang %s nhu bang ghi", (_cap, mau, nen, mong) => {
    expect(bangMau[mau], `${mau} khong phai mau trong tokens.css`).toBeDefined();
    expect(bangMau[nen], `${nen} khong phai mau trong tokens.css`).toBeDefined();
    expect(contrastRatio(bangMau[mau], bangMau[nen])).toBeCloseTo(mong, 2);
  });
});

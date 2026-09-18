import { describe, it, expect } from "vitest";
import { initialOf } from "@/lib/initial";

describe("initialOf", () => {
  it("lay chu dau, viet hoa, bo khoang trang hai dau", () => {
    expect(initialOf("Linh")).toBe("L");
    expect(initialOf("  mạnh")).toBe("M");
    expect(initialOf("ánh")).toBe("Á");
  });

  it("chu go kieu to hop (chu cai cong dau rieng) van giu nguyen dau", () => {
    const aSac = String.fromCodePoint(0x61, 0x301);
    expect(initialOf(`${aSac}nh`)).toBe(String.fromCodePoint(0x41, 0x301));
  });

  it("chuoi rong thi tra chuoi rong", () => {
    expect(initialOf("   ")).toBe("");
  });
});

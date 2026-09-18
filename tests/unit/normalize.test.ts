import { describe, it, expect } from "vitest";
import { normalize } from "@/lib/vi";

describe("normalize", () => {
  it("bo dau tieng Viet", () => {
    expect(normalize("Mưa đầu tháng chín")).toBe("mua dau thang chin");
  });

  it("xu ly duoc chu d gach ngang, thu ma NFD khong tach ra", () => {
    expect(normalize("Đường")).toBe("duong");
    expect(normalize("đi đâu")).toBe("di dau");
  });

  it("gop khoang trang thua va cat hai dau", () => {
    expect(normalize("  quán   cà   phê cũ  ")).toBe("quan ca phe cu");
  });

  it("cung mot cau viet hoa khac nhau cho ra ket qua giong nhau", () => {
    expect(normalize("BẾN XE")).toBe(normalize("bến xe"));
  });

  it("chuoi rong van tra ve chuoi rong", () => {
    expect(normalize("   ")).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { matchesAnswer, normalizeAnswer } from "@/lib/seal/answer";

describe("normalizeAnswer", () => {
  it("bo dau, thuong hoa, bo dau cau, gop khoang trang", () => {
    expect(normalizeAnswer("  Quán Cà-Phê, ở Đà Lạt!!  ")).toBe("quan ca phe o da lat");
  });

  it("dau cau o giua hai tu thanh khoang trang de khong dinh hai tu vao nhau", () => {
    expect(normalizeAnswer("xe.buyt")).toBe("xe buyt");
  });

  it("giu chu so", () => {
    expect(normalizeAnswer("Ngày 20/10")).toBe("ngay 20 10");
  });

  it("chi con dau cau thi ra chuoi rong", () => {
    expect(normalizeAnswer("?!... ,")).toBe("");
  });
});

describe("matchesAnswer", () => {
  const answers = ["ben xe mien dong", "mien dong"];

  it("khop khi chuoi go chuan hoa ra dung mot dap an", () => {
    expect(matchesAnswer("Bến xe Miền Đông.", answers)).toBe(true);
    expect(matchesAnswer("MIỀN   ĐÔNG", answers)).toBe(true);
  });

  it("khong khop mot phan cua dap an", () => {
    expect(matchesAnswer("mien", answers)).toBe(false);
  });

  it("chuoi rong hoac chi dau cau khong bao gio khop, ke ca khi danh sach lot mot chuoi rong", () => {
    expect(matchesAnswer("...", [""])).toBe(false);
    expect(matchesAnswer("", answers)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { parseNameInput } from "@/server/identity/input";

function fd(nickname: string, secret: string): FormData {
  const f = new FormData();
  f.set("nickname", nickname);
  f.set("secret", secret);
  return f;
}

describe("parseNameInput", () => {
  it("biet danh rong thi bao loi", () => {
    expect(parseNameInput(fd("", "du dai roi"))).toEqual({
      error: "Biệt danh phải từ 1 tới 20 ký tự.",
    });
  });

  it("biet danh chi toan khoang trang thi bao loi", () => {
    expect(parseNameInput(fd("   ", "du dai roi"))).toEqual({
      error: "Biệt danh phải từ 1 tới 20 ký tự.",
    });
  });

  it("biet danh dung 20 ky tu thi qua", () => {
    const ten = "a".repeat(20);
    expect(parseNameInput(fd(ten, "du dai roi"))).toEqual({ nickname: ten, secret: "du dai roi" });
  });

  it("biet danh 21 ky tu thi bao loi", () => {
    const ten = "a".repeat(21);
    expect(parseNameInput(fd(ten, "du dai roi"))).toEqual({
      error: "Biệt danh phải từ 1 tới 20 ký tự.",
    });
  });

  it("loi nhan 3 ky tu thi bao loi", () => {
    expect(parseNameInput(fd("Manh", "abc"))).toEqual({
      error: "Lời nhắn bí mật phải dài ít nhất 4 ký tự.",
    });
  });

  it("loi nhan 4 ky tu thi qua", () => {
    expect(parseNameInput(fd("Manh", "abcd"))).toEqual({ nickname: "Manh", secret: "abcd" });
  });

  it("cat khoang trang hai dau cua bien danh va loi nhan", () => {
    expect(parseNameInput(fd("  Manh  ", "  hien nha hom mua  "))).toEqual({
      nickname: "Manh",
      secret: "hien nha hom mua",
    });
  });

  it("loi nhan dung 500 ky tu thi qua", () => {
    const secret = "a".repeat(500);
    expect(parseNameInput(fd("Manh", secret))).toEqual({ nickname: "Manh", secret });
  });

  it("loi nhan 501 ky tu thi bao loi", () => {
    const secret = "a".repeat(501);
    expect(parseNameInput(fd("Manh", secret))).toEqual({
      error: "Lời nhắn bí mật dài tối đa 500 ký tự.",
    });
  });

  it("biet danh hoac loi nhan co ky tu Postgres khong luu duoc thi bi tu choi", () => {
    const NUL = String.fromCharCode(0);
    expect(parseNameInput(fd(`Manh${NUL}`, "du dai roi"))).toEqual({ error: "Biệt danh phải từ 1 tới 20 ký tự." });
    expect(parseNameInput(fd("Manh", `du dai roi${NUL}`))).toEqual({ error: "Lời nhắn bí mật phải dài ít nhất 4 ký tự." });
  });
});

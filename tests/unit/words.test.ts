import { describe, it, expect } from "vitest";
import { WORDS } from "@/server/identity/words";
import { normalize } from "@/lib/vi";

describe("WORDS", () => {
  it("dung 256 tu, de phep chia lay du duoc dong deu", () => {
    expect(WORDS.length).toBe(256);
  });

  it("khong tu nao trung nhau", () => {
    expect(new Set(WORDS).size).toBe(256);
  });

  it("moi tu deu khong dau, chi chu thuong a-z", () => {
    for (const w of WORDS) expect(w, `tu xau: ${w}`).toMatch(/^[a-z]{2,6}$/);
  });

  it("moi tu deu da o dang chuan hoa", () => {
    for (const w of WORDS) expect(normalize(w)).toBe(w);
  });
});

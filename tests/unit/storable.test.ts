import { describe, it, expect } from "vitest";
import { isStorable, sliceWhole, toStorable } from "@/lib/storable";

const NUL = String.fromCharCode(0);
const HIGH = String.fromCharCode(0xd83d);
const LOW = String.fromCharCode(0xde00);
/** Mot emoji day du: hai don vi UTF-16. */
const EMOJI = HIGH + LOW;

describe("isStorable", () => {
  it("chu tieng Viet, emoji day du va chuoi rong deu luu duoc", () => {
    expect(isStorable("Mình gặp nhau ở đâu?")).toBe(true);
    expect(isStorable(`a${EMOJI}b`)).toBe(true);
    expect(isStorable("")).toBe(true);
  });

  it.each([
    ["ky tu NUL", `a${NUL}b`],
    ["surrogate cao le o cuoi", `a${HIGH}`],
    ["surrogate cao dung truoc chu thuong", `${HIGH}a`],
    ["surrogate thap dung mot minh", `a${LOW}`],
    ["cap surrogate dao nguoc", LOW + HIGH],
  ])("khong luu duoc: %s", (_ten, s) => {
    expect(isStorable(s)).toBe(false);
  });
});

describe("toStorable", () => {
  it("giu nguyen chuoi da luu duoc", () => {
    const s = `Mưa ${EMOJI}`;
    expect(toStorable(s)).toBe(s);
  });

  it("bo NUL va nua cap le, giu emoji day du", () => {
    expect(toStorable(`a${NUL}b${HIGH}c${EMOJI}${LOW}`)).toBe(`abc${EMOJI}`);
  });
});

describe("sliceWhole", () => {
  it("cat dung max khi cho cat khong xe doi emoji", () => {
    expect(sliceWhole("abcdef", 3)).toBe("abc");
    expect(sliceWhole(`ab${EMOJI}`, 4)).toBe(`ab${EMOJI}`);
  });

  it("lui mot don vi khi cho cat roi vao giua mot emoji", () => {
    expect(sliceWhole(`ab${EMOJI}`, 3)).toBe("ab");
  });
});

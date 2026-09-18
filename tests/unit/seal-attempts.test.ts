import { describe, it, expect } from "vitest";
import { attemptState, SEAL_COOLDOWN_MS, SEAL_MAX_FAILS } from "@/lib/seal/attempts";

const T0 = new Date("2026-09-13T08:00:00.000Z");
const at = (phut: number) => new Date(T0.getTime() + phut * 60_000);
/** n lan sai, moi lan cach nhau mot phut, bat dau tu T0. */
const sai = (n: number) => Array.from({ length: n }, (_, i) => at(i));

describe("attemptState", () => {
  it("chua sai lan nao: con du 5 lan, chua mo goi y, khong phai cho", () => {
    expect(attemptState([], 3, at(0))).toEqual({ hintsUnlocked: 0, remaining: 5, lockedUntil: null });
  });

  it("sai 2, 4, 6 lan thi mo goi y 1, 2, 3", () => {
    const moi = (n: number) => attemptState(sai(n), 3, at(100)).hintsUnlocked;
    expect([1, 2, 3, 4, 5, 6, 7].map(moi)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it("khong mo nhieu goi y hon so goi y nguoi viet da soan", () => {
    expect(attemptState(sai(6), 1, at(100)).hintsUnlocked).toBe(1);
    expect(attemptState(sai(6), 0, at(100)).hintsUnlocked).toBe(0);
  });

  it("so lan con lai giam dan tu 5", () => {
    expect([0, 1, 2, 3, 4].map((n) => attemptState(sai(n), 0, at(n)).remaining)).toEqual([5, 4, 3, 2, 1]);
  });

  it("sai lan thu 5 thi phai cho 10 phut tinh tu chinh lan sai do", () => {
    const s = attemptState(sai(5), 0, at(4));
    expect(s.remaining).toBe(0);
    expect(s.lockedUntil).toEqual(new Date(at(4).getTime() + SEAL_COOLDOWN_MS));
  });

  it("con 1ms van phai cho; du 10 phut thi het cho va duoc them 5 lan", () => {
    const het = new Date(at(4).getTime() + SEAL_COOLDOWN_MS);
    expect(attemptState(sai(5), 0, new Date(het.getTime() - 1)).lockedUntil).not.toBeNull();
    expect(attemptState(sai(5), 0, het)).toEqual({ hintsUnlocked: 0, remaining: SEAL_MAX_FAILS, lockedUntil: null });
  });

  it("sai lan thu 10 lai phai cho, tinh tu lan sai thu 10", () => {
    const tim = [...sai(5), at(30), at(31), at(32), at(33), at(34)];
    const s = attemptState(tim, 0, at(35));
    expect(s.remaining).toBe(0);
    expect(s.lockedUntil).toEqual(new Date(at(34).getTime() + SEAL_COOLDOWN_MS));
  });
});

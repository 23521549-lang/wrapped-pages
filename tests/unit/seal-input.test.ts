import { describe, it, expect } from "vitest";
import { parseSealInput } from "@/lib/seal/input";
import { SEAL_LIMITS } from "@/lib/seal/types";

const NOW = new Date("2026-09-13T08:00:00.000Z");
const sau = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("parseSealInput", () => {
  it("khong gui niem phong thi hop le va khong gan gi", () => {
    expect(parseSealInput(null, "chia-se", NOW)).toEqual({ ok: true, seal: null });
    expect(parseSealInput(undefined, "rieng-tu", NOW)).toEqual({ ok: true, seal: null });
  });

  it("cau do: cat khoang trang, chuan hoa va bo trung dap an, bo goi y rong", () => {
    const r = parseSealInput(
      {
        kind: "cau-do",
        question: "  Mình gặp nhau ở đâu? ",
        answers: ["Bến xe Miền Đông", "ben xe mien dong!", "  "],
        hints: ["Có xe khách", ""],
      },
      "chia-se",
      NOW,
    );
    expect(r).toEqual({
      ok: true,
      seal: { kind: "cau-do", question: "Mình gặp nhau ở đâu?", answers: ["ben xe mien dong"], hints: ["Có xe khách"] },
    });
  });

  it("cau do khong gui goi y thi danh sach goi y rong", () => {
    const r = parseSealInput({ kind: "cau-do", question: "a", answers: ["b"] }, "chia-se", NOW);
    expect(r).toEqual({ ok: true, seal: { kind: "cau-do", question: "a", answers: ["b"], hints: [] } });
  });

  it("trao doi chi can cau hoi", () => {
    expect(parseSealInput({ kind: "trao-doi", question: "Hôm đó em nghĩ gì?" }, "chia-se", NOW))
      .toEqual({ ok: true, seal: { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" } });
  });

  it("hen gio nhan chuoi ISO co mui gio, ke ca tren sach rieng tu", () => {
    const r = parseSealInput({ kind: "hen-gio", opensAt: sau(3_600_000) }, "rieng-tu", NOW);
    expect(r).toEqual({ ok: true, seal: { kind: "hen-gio", opensAt: new Date(NOW.getTime() + 3_600_000) } });
  });

  it("hen gio nhan do lech mui gio dang +07:00", () => {
    const r = parseSealInput({ kind: "hen-gio", opensAt: "2026-09-13T16:00:00+07:00" }, "chia-se", NOW);
    expect(r).toEqual({ ok: true, seal: { kind: "hen-gio", opensAt: new Date("2026-09-13T09:00:00.000Z") } });
  });

  it("sach rieng tu chi gan duoc hen gio", () => {
    expect(parseSealInput({ kind: "cau-do", question: "a", answers: ["b"] }, "rieng-tu", NOW).ok).toBe(false);
    expect(parseSealInput({ kind: "trao-doi", question: "a" }, "rieng-tu", NOW).ok).toBe(false);
  });

  it("dung bien 1 phut va 10 nam thi van nhan", () => {
    expect(parseSealInput({ kind: "hen-gio", opensAt: sau(SEAL_LIMITS.minLeadMs) }, "chia-se", NOW).ok).toBe(true);
    expect(parseSealInput({ kind: "hen-gio", opensAt: sau(SEAL_LIMITS.maxLeadMs) }, "chia-se", NOW).ok).toBe(true);
  });

  it("dung bien tren cua moi gioi han van nhan, ke ca emoji day du", () => {
    const r = parseSealInput(
      {
        kind: "cau-do",
        question: "a".repeat(SEAL_LIMITS.questionMax),
        answers: Array.from({ length: SEAL_LIMITS.answersMax }, (_, i) => (i === 0 ? "b".repeat(SEAL_LIMITS.answerMax) : `dap an ${i}`)),
        hints: Array.from({ length: SEAL_LIMITS.hintsMax }, (_, i) => (i === 0 ? "h".repeat(SEAL_LIMITS.hintMax) : `goi y ${i}`)),
      },
      "chia-se",
      NOW,
    );
    expect(r.ok && r.seal?.kind === "cau-do" ? [r.seal.question.length, r.seal.answers.length, r.seal.hints.length] : null)
      .toEqual([SEAL_LIMITS.questionMax, SEAL_LIMITS.answersMax, SEAL_LIMITS.hintsMax]);
    const emoji = String.fromCharCode(0xd83d, 0xde00);
    expect(parseSealInput({ kind: "trao-doi", question: emoji }, "chia-se", NOW))
      .toEqual({ ok: true, seal: { kind: "trao-doi", question: emoji } });
  });

  const NUL = String.fromCharCode(0);
  it.each([
    ["loai la", { kind: "mat-khau" }, "Loại niêm phong"],
    ["khong phai object", "cau-do", "Loại niêm phong"],
    ["mang", [], "Loại niêm phong"],
    ["cau hoi rong", { kind: "trao-doi", question: "   " }, "Câu hỏi"],
    ["cau hoi qua dai", { kind: "trao-doi", question: "a".repeat(SEAL_LIMITS.questionMax + 1) }, "Câu hỏi"],
    ["cau hoi khong phai chuoi", { kind: "trao-doi", question: 7 }, "Câu hỏi"],
    ["cau hoi co ky tu NUL", { kind: "trao-doi", question: `a${NUL}` }, "Câu hỏi"],
    ["cau hoi co surrogate thap le", { kind: "trao-doi", question: `a${String.fromCharCode(0xdc00)}` }, "Câu hỏi"],
    ["cau do khong dap an", { kind: "cau-do", question: "a", answers: [] }, "đáp án"],
    ["cau do thieu truong dap an", { kind: "cau-do", question: "a" }, "đáp án"],
    ["dap an chi co dau cau", { kind: "cau-do", question: "a", answers: ["?!"] }, "đáp án"],
    ["qua 5 dap an", { kind: "cau-do", question: "a", answers: ["a", "b", "c", "d", "e", "f"] }, "đáp án"],
    ["dap an qua dai", { kind: "cau-do", question: "a", answers: ["a".repeat(SEAL_LIMITS.answerMax + 1)] }, "đáp án"],
    ["dap an khong phai chuoi", { kind: "cau-do", question: "a", answers: [42] }, "đáp án"],
    ["dap an co ky tu NUL", { kind: "cau-do", question: "a", answers: [`b${NUL}`] }, "đáp án"],
    ["qua 3 goi y", { kind: "cau-do", question: "a", answers: ["b"], hints: ["1", "2", "3", "4"] }, "gợi ý"],
    ["goi y qua dai", { kind: "cau-do", question: "a", answers: ["b"], hints: ["a".repeat(SEAL_LIMITS.hintMax + 1)] }, "gợi ý"],
    ["goi y co ky tu NUL", { kind: "cau-do", question: "a", answers: ["b"], hints: [`x${NUL}`] }, "gợi ý"],
    ["goi y la surrogate cao le", { kind: "cau-do", question: "a", answers: ["b"], hints: [String.fromCharCode(0xd800)] }, "gợi ý"],
    ["hen gio thieu mui gio", { kind: "hen-gio", opensAt: "2026-09-20T08:00" }, "Giờ mở"],
    ["hen gio sai dinh dang", { kind: "hen-gio", opensAt: "ngay mai" }, "Giờ mở"],
    ["hen gio chuoi khong phai ISO nhung ket thuc bang Z", { kind: "hen-gio", opensAt: "Sep 20 2026Z" }, "Giờ mở"],
    ["hen gio co chu dung truoc chuoi ISO", { kind: "hen-gio", opensAt: "hello 2026-09-20T08:00:00+07:00" }, "Giờ mở"],
    ["hen gio chi co ngay", { kind: "hen-gio", opensAt: "2026-09-20Z" }, "Giờ mở"],
    ["hen gio la so", { kind: "hen-gio", opensAt: NOW.getTime() + 3_600_000 }, "Giờ mở"],
    ["hen gio som hon 1 phut", { kind: "hen-gio", opensAt: sau(59_000) }, "Giờ mở"],
    ["hen gio trong qua khu", { kind: "hen-gio", opensAt: sau(-1000) }, "Giờ mở"],
    ["hen gio qua 10 nam", { kind: "hen-gio", opensAt: sau(SEAL_LIMITS.maxLeadMs + 1) }, "Giờ mở"],
  ])("tu choi: %s", (_ten, raw, loi) => {
    expect(parseSealInput(raw, "chia-se", NOW)).toEqual({ ok: false, error: expect.stringContaining(loi) });
  });
});

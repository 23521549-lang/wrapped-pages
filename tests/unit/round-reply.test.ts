import { describe, expect, it } from "vitest";
import { roundAt } from "@/lib/round";
import { checkReplyBody, normalizeReplyBody, REPLY_MAX, replyLength, replyRounds, shownRound } from "@/lib/round-reply";

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const dong = (...d: string[]) => d.join(LF);
/** Mot ky tu ngoai BMP: hai don vi UTF-16, mot code point. */
const HOA = String.fromCodePoint(0x1f338);

describe("normalizeReplyBody", () => {
  it("bo khoang trang va dong trong o hai dau", () => {
    expect(normalizeReplyBody(`  ${LF}${LF} Thương ghê. ${LF}  `)).toBe("Thương ghê.");
  });

  it("gop moi day dong trong con toi da hai; dong chi co khoang trang cung la dong trong", () => {
    expect(normalizeReplyBody(dong("Một", "", "", "", "", "Hai"))).toBe(dong("Một", "", "", "Hai"));
    expect(normalizeReplyBody(dong("Một", "  ", " ", "", "Hai"))).toBe(dong("Một", "", "", "Hai"));
    expect(normalizeReplyBody(dong("Một", "", "Hai", " ", "", "Ba"))).toBe(dong("Một", "", "Hai", "", "", "Ba"));
  });

  it("doi CRLF va CR ve LF, giu nguyen khoang trang ben trong dong", () => {
    expect(normalizeReplyBody(`Một${CR}${LF}Hai${CR}Ba`)).toBe(dong("Một", "Hai", "Ba"));
    expect(normalizeReplyBody("Một  hai   ba")).toBe("Một  hai   ba");
  });
});

describe("replyLength", () => {
  it("dem theo code point nhu char_length cua Postgres", () => {
    expect(replyLength(`${HOA}${HOA}${HOA}ab`)).toBe(5);
    expect(replyLength("")).toBe(0);
  });
});

describe("checkReplyBody", () => {
  it("tra chu da chuan hoa khi hop le", () => {
    expect(checkReplyBody(`  Một${LF}${LF}${LF}${LF}Hai  `)).toEqual({ ok: true, body: dong("Một", "", "", "Hai") });
  });

  it("rong sau khi chuan hoa thi empty", () => {
    expect(checkReplyBody("")).toEqual({ ok: false, reason: "empty" });
    expect(checkReplyBody(`  ${LF}  ${LF}`)).toEqual({ ok: false, reason: "empty" });
  });

  it("dem sau khi chuan hoa: dung REPLY_MAX thi nhan, hon mot ky tu thi too-long", () => {
    expect(checkReplyBody(HOA.repeat(REPLY_MAX))).toEqual({ ok: true, body: HOA.repeat(REPLY_MAX) });
    expect(checkReplyBody(HOA.repeat(REPLY_MAX + 1))).toEqual({ ok: false, reason: "too-long" });
    expect(checkReplyBody(`${"a".repeat(REPLY_MAX)}${LF.repeat(5)}`)).toEqual({ ok: true, body: "a".repeat(REPLY_MAX) });
  });

  it("khong phai chuoi, hay co ky tu Postgres khong luu duoc, thi invalid", () => {
    expect(checkReplyBody(42)).toEqual({ ok: false, reason: "invalid" });
    expect(checkReplyBody(null)).toEqual({ ok: false, reason: "invalid" });
    expect(checkReplyBody(`a${String.fromCharCode(0)}b`)).toEqual({ ok: false, reason: "invalid" });
    expect(checkReplyBody(`a${String.fromCharCode(0xd800)}b`)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("luot cua to dang hien", () => {
  const LUOT = [
    { id: "l1", first: 1, last: 1, sealed: false },
    { id: "l2", first: 2, last: 3, sealed: true },
  ];

  it("roundAt tim luot chua mot to", () => {
    expect(roundAt(LUOT, 1)?.id).toBe("l1");
    expect(roundAt(LUOT, 3)?.id).toBe("l2");
    expect(roundAt(LUOT, 4)).toBeUndefined();
  });

  it("shownRound theo to ben phai; khung cuoi mot to thi theo to do; ngoai sach thi undefined", () => {
    expect(shownRound(LUOT, { first: 1, last: 2 })?.id).toBe("l2");
    expect(shownRound(LUOT, { first: 1, last: 1 })?.id).toBe("l1");
    expect(shownRound(LUOT, { first: 3, last: 3 })?.id).toBe("l2");
    expect(shownRound(LUOT, { first: 9, last: 9 })).toBeUndefined();
  });

  it("replyRounds gan loi hoi dap vao dung luot, luot chua co thi null", () => {
    const luc = new Date("2026-09-22T01:00:00.000Z");
    expect(replyRounds(LUOT, [{ roundId: "l2", body: "Thương ghê.", createdAt: luc }])).toEqual([
      { id: "l1", first: 1, last: 1, sealed: false, reply: null },
      { id: "l2", first: 2, last: 3, sealed: true, reply: { body: "Thương ghê.", at: luc } },
    ]);
  });
});

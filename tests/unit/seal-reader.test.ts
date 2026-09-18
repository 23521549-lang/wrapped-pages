import { describe, it, expect } from "vitest";
import { pageRange, pageRangeTitle, panelOf, revealTarget, ritualKey, sealsInView, sheetLooks } from "@/lib/seal/reader";
import type { ReaderSeal, ReaderSheet } from "@/lib/seal/types";

type ToNho = Pick<ReaderSheet, "locked" | "sealId" | "teaser">;

const niem = (sua: Partial<ReaderSeal>): ReaderSeal => ({
  id: "s1", kind: "cau-do", firstPosition: 2, lastPosition: 3, mine: false, locked: true,
  question: "Ở đâu?", opensAt: null, hints: [], remaining: 5, lockedUntil: null, openedAt: null, ritual: false,
  giftNote: null, reply: null, answerCount: null, knocks: [], ...sua,
});

const thuong: ToNho = { locked: false, sealId: null, teaser: null };

describe("sheetLooks", () => {
  it("to khoa chi mang dong he lo cua chinh no; to thuong ve nhu cu", () => {
    const tos: ToNho[] = [thuong, { locked: true, sealId: "s1", teaser: "Dòng đầu" }, { locked: true, sealId: "s1", teaser: null }];
    expect(sheetLooks(tos, [niem({})])).toEqual([
      { kind: "thuong" }, { kind: "khoa", teaser: "Dòng đầu" }, { kind: "khoa", teaser: null },
    ]);
  });

  it("chu sach thay dau nho tren to cau do va trao doi nguoi kia chua mo", () => {
    const to: ToNho = { locked: false, sealId: "s1", teaser: null };
    expect(sheetLooks([to], [niem({ mine: true, locked: false })])).toEqual([{ kind: "dau", label: "Đang niêm phong bằng câu đố" }]);
    expect(sheetLooks([to], [niem({ kind: "trao-doi", mine: true, locked: false })]))
      .toEqual([{ kind: "dau", label: "Đang niêm phong bằng trao đổi" }]);
  });

  it("da mo roi, hoac khong phai sach cua minh, hoac hen gio da toi gio, thi khong con dau", () => {
    const to: ToNho = { locked: false, sealId: "s1", teaser: null };
    expect(sheetLooks([to], [niem({ mine: true, locked: false, openedAt: new Date() })])).toEqual([{ kind: "thuong" }]);
    expect(sheetLooks([to], [niem({ mine: false, locked: false, openedAt: null })])).toEqual([{ kind: "thuong" }]);
    expect(sheetLooks([to], [niem({ kind: "hen-gio", mine: true, locked: false })])).toEqual([{ kind: "thuong" }]);
  });
});

describe("panelOf", () => {
  const doc = { type: "doc" as const, content: [{ type: "paragraph" as const }] };

  it("hen gio con khoa thi ca hai nguoi thay dong ho; toi gio thi khong con khung", () => {
    expect(panelOf(niem({ kind: "hen-gio", mine: true, locked: true }))).toBe("hen-gio");
    expect(panelOf(niem({ kind: "hen-gio", mine: false, locked: true }))).toBe("hen-gio");
    expect(panelOf(niem({ kind: "hen-gio", locked: false }))).toBeNull();
  });

  it("nguoi kia: cau do va trao doi con khoa thi khung thu thach tuong ung", () => {
    expect(panelOf(niem({}))).toBe("cau-do");
    expect(panelOf(niem({ kind: "trao-doi" }))).toBe("trao-doi");
  });

  it("chu sach luon co khung cua minh cho cau do va trao doi, du nguoi kia da mo hay chua", () => {
    expect(panelOf(niem({ mine: true, locked: false }))).toBe("cua-toi");
    expect(panelOf(niem({ mine: true, locked: false, openedAt: new Date(), giftNote: "Cho em" }))).toBe("cua-toi");
    expect(panelOf(niem({ kind: "trao-doi", mine: true, locked: false }))).toBe("cua-toi");
  });

  it("trao doi da co trang tra loi thi ca hai nguoi thay trang tra loi", () => {
    for (const mine of [true, false]) {
      expect(panelOf(niem({ kind: "trao-doi", mine, locked: false, openedAt: new Date(), reply: doc }))).toBe("trang-tra-loi");
    }
  });

  it("nguoi kia da mo: co loi nhan thi khung tang khoa, mo bang dap an thi khong co khung", () => {
    expect(panelOf(niem({ locked: false, openedAt: new Date(), giftNote: "Cho em" }))).toBe("tang-khoa");
    expect(panelOf(niem({ locked: false, openedAt: new Date() }))).toBeNull();
  });
});

describe("sealsInView va pageRange", () => {
  const ds = [niem({ id: "a", firstPosition: 2, lastPosition: 3 }), niem({ id: "b", firstPosition: 5, lastPosition: 5 })];

  it("lay moi niem phong phu it nhat mot to dang hien", () => {
    expect(sealsInView(ds, 1, 1).map((s) => s.id)).toEqual([]);
    expect(sealsInView(ds, 1, 2).map((s) => s.id)).toEqual(["a"]);
    expect(sealsInView(ds, 3, 4).map((s) => s.id)).toEqual(["a"]);
    expect(sealsInView(ds, 3, 5).map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("mot to hay mot khoang to", () => {
    expect(pageRange(5, 5)).toBe("trang 5");
    expect(pageRange(5, 7)).toBe("trang 5 tới 7");
  });

  it("tieu de: viet hoa chu dau, mot to hay mot khoang to", () => {
    expect(pageRangeTitle(5, 5)).toBe("Trang 5");
    expect(pageRangeTitle(5, 7)).toBe("Trang 5 tới 7");
  });
});

describe("revealTarget", () => {
  const tos = [{ position: 1 }, { position: 2 }, { position: 3 }];
  const vuaMo = niem({ id: "s1", firstPosition: 2, lastPosition: 3, locked: false, remaining: null, openedAt: new Date(), ritual: true });

  it("URL co mo cua niem phong ma may chu tra ritual true thi chay tren to dau cua niem phong, kem dung ma da kiem", () => {
    expect(revealTarget(tos, [vuaMo], "s1")).toEqual({ index: 1, sealId: "s1" });
  });

  it("chi so to lay theo vi tri that cua to dau, khong gia dinh vi tri lien nhau tu 1", () => {
    const giua = niem({ ...vuaMo, id: "s2", firstPosition: 7, lastPosition: 7 });
    expect(revealTarget([{ position: 1 }, { position: 7 }], [vuaMo, giua], "s2")).toEqual({ index: 1, sealId: "s2" });
  });

  it("khong co mo, mo la mang, ma khong co trong sach, hay to dau khong co trong sach thi khong chay", () => {
    expect(revealTarget(tos, [vuaMo], undefined)).toBeNull();
    expect(revealTarget(tos, [vuaMo], ["s1", "s1"])).toBeNull();
    expect(revealTarget(tos, [vuaMo], "khac")).toBeNull();
    expect(revealTarget([{ position: 1 }], [vuaMo], "s1")).toBeNull();
  });

  it("chi may chu quyet: da mo, khong phai hen gio, nhung ritual false (tang chia khoa, chu sach, tab cu, qua 2 phut) thi khong chay", () => {
    expect(revealTarget(tos, [{ ...vuaMo, ritual: false, giftNote: "Cho em" }], "s1")).toBeNull();
    expect(revealTarget(tos, [{ ...vuaMo, ritual: false, mine: true }], "s1")).toBeNull();
    expect(revealTarget(tos, [{ ...vuaMo, ritual: false }], "s1")).toBeNull();
  });
});

describe("ritualKey", () => {
  it("moi niem phong mot khoa sessionStorage rieng", () => {
    expect(ritualKey("s1")).toBe("mqce:nghi-thuc:s1");
    expect(ritualKey("s2")).not.toBe(ritualKey("s1"));
  });
});

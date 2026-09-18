import { describe, it, expect } from "vitest";
import { blankAnswerIds, emptySeal, entryRow, localInputValue, sealPayload, type SealDraft } from "@/components/editor/sealDraft";
import { parseSealInput } from "@/lib/seal/input";

const NOW = new Date("2026-09-13T08:00:00.000Z");
const nhap = (sua: Partial<SealDraft>): SealDraft => ({ ...emptySeal(), ...sua });

/** Chay fn voi mui gio cua tien trinh dat tam la zone, xong tra lai. Node doc lai mui gio ngay khi process.env.TZ doi. */
function trongMuiGio(zone: string, fn: () => void): void {
  const cu = process.env.TZ;
  process.env.TZ = zone;
  try {
    fn();
  } finally {
    if (cu === undefined) delete process.env.TZ;
    else process.env.TZ = cu;
  }
}

describe("sealPayload", () => {
  it("khong niem phong thi gui null", () => {
    expect(sealPayload(emptySeal())).toEqual({ seal: null });
  });

  it("cau do gui chuoi tho cua tung dong, may chu tu chuan hoa va bo dong rong", () => {
    const d = nhap({
      kind: "cau-do",
      question: "Mình gặp nhau ở đâu?",
      answers: [entryRow("Bến xe Miền Đông"), entryRow("")],
      hints: [entryRow("Có xe khách")],
    });
    expect(sealPayload(d)).toEqual({
      seal: { kind: "cau-do", question: "Mình gặp nhau ở đâu?", answers: ["Bến xe Miền Đông", ""], hints: ["Có xe khách"] },
    });
  });

  it("trao doi chi gui cau hoi, khong gui dap an hay goi y dang go do", () => {
    const d = nhap({ kind: "trao-doi", question: "Hôm đó em nghĩ gì?", answers: [entryRow("a")], hints: [entryRow("b")] });
    expect(sealPayload(d)).toEqual({ seal: { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" } });
  });

  it("hen gio doi gio dia phuong sang ISO co Z theo dung mui gio dang chay, va parseSealInput nhan chuoi do", () => {
    trongMuiGio("Asia/Ho_Chi_Minh", () => {
      const r = sealPayload(nhap({ kind: "hen-gio", opensAt: "2026-09-20T07:30" }));
      expect(r).toEqual({ seal: { kind: "hen-gio", opensAt: "2026-09-20T00:30:00.000Z" } });
      if (!("seal" in r) || r.seal?.kind !== "hen-gio") throw new Error("khong ra hen gio");
      expect(parseSealInput(r.seal, "rieng-tu", NOW).ok).toBe(true);
    });
    trongMuiGio("UTC", () => {
      expect(sealPayload(nhap({ kind: "hen-gio", opensAt: "2026-09-20T07:30" }))).toEqual({
        seal: { kind: "hen-gio", opensAt: "2026-09-20T07:30:00.000Z" },
      });
    });
  });

  it("chuoi tho cua datetime-local bi may chu tu choi: ly do phai doi o trinh duyet", () => {
    expect(parseSealInput({ kind: "hen-gio", opensAt: "2026-09-20T07:30" }, "chia-se", NOW).ok).toBe(false);
  });

  it("hen gio chua chon hoac sai dinh dang thi bao loi, khong gui gi", () => {
    expect(sealPayload(nhap({ kind: "hen-gio", opensAt: "" }))).toEqual({ error: "Chọn ngày giờ mở." });
    expect(sealPayload(nhap({ kind: "hen-gio", opensAt: "ngay mai" }))).toEqual({ error: "Chọn ngày giờ mở." });
  });

  it("moi dong co id rieng de lam key", () => {
    expect(entryRow().id).not.toBe(entryRow().id);
  });
});

describe("localInputValue", () => {
  it("ra dung dang cua datetime-local theo gio dia phuong, cat toi phut", () => {
    expect(localInputValue(new Date(2026, 8, 3, 7, 5, 59))).toBe("2026-09-03T07:05");
    trongMuiGio("Asia/Ho_Chi_Minh", () => {
      expect(localInputValue(new Date("2026-12-31T17:30:00.000Z"))).toBe("2027-01-01T00:30");
    });
  });
});

describe("blankAnswerIds", () => {
  it("chi danh dau dong co chu ma chuan hoa ra rong; may chu tu choi dung cau do do", () => {
    const rows = [entryRow("?!"), entryRow("Bến xe"), entryRow("   "), entryRow("...")];
    const d = nhap({ kind: "cau-do", question: "Mình gặp nhau ở đâu?", answers: rows });
    expect([...blankAnswerIds(d)]).toEqual([rows[0].id, rows[3].id]);
    const r = sealPayload(d);
    if (!("seal" in r)) throw new Error("cau do khong bao loi o sealPayload");
    expect(parseSealInput(r.seal, "chia-se", NOW).ok).toBe(false);
  });

  it("khong danh dau gi voi loai khac cau do, hay khi moi dong co chu deu con chu", () => {
    const rows = [entryRow("?!")];
    expect(blankAnswerIds(nhap({ kind: "trao-doi", question: "Hôm đó em nghĩ gì?", answers: rows })).size).toBe(0);
    expect(blankAnswerIds(nhap({ kind: "cau-do", answers: [entryRow("Bến xe"), entryRow("")] })).size).toBe(0);
  });
});

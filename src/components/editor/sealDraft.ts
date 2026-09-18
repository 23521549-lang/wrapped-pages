import { normalizeAnswer } from "@/lib/seal/answer";
import type { SealKind } from "@/lib/seal/types";
import { haiChuSo } from "@/lib/when";

/** Lua chon o buoc xac nhan dang: khong niem phong, hoac mot trong ba loai. */
export type SealChoice = "khong" | SealKind;

/** Mot dong trong danh sach dap an hay goi y. id chi lam key cho React, khong bao gio gui len may chu. */
export type EntryRow = { id: number; text: string };

/** Niem phong dang soan trong hop xac nhan dang, dung nhu nguoi dung dang go. */
export type SealDraft = {
  kind: SealChoice;
  question: string;
  answers: EntryRow[];
  hints: EntryRow[];
  /** Gia tri tho cua o datetime-local: gio dia phuong, khong co mui gio. */
  opensAt: string;
};

/** Hinh gui len actionPublish. parseSealInput o may chu kiem lai tu dau, nen day chua phai du lieu da tin. */
export type SealPayload =
  | { kind: "cau-do"; question: string; answers: string[]; hints: string[] }
  | { kind: "hen-gio"; opensAt: string }
  | { kind: "trao-doi"; question: string };

let dem = 0;

/** Dong moi cho danh sach dap an hay goi y. */
export function entryRow(text = ""): EntryRow {
  dem += 1;
  return { id: dem, text };
}

/** Trang thai luc mo hop: khong niem phong, san mot o dap an trong, chua co goi y. */
export function emptySeal(): SealDraft {
  return { kind: "khong", question: "", answers: [entryRow()], hints: [], opensAt: "" };
}

/**
 * Doi niem phong dang soan sang hinh gui len may chu. Gio mo cua datetime-local khong co mui gio, ma may
 * chu chay gio UTC va parseSealInput tu choi chuoi khong mui gio, nen o day doi ngay tren trinh
 * duyet bang new Date(v).toISOString(): trinh duyet moi biet gio dia phuong cua nguoi dang go.
 */
export function sealPayload(d: SealDraft): { seal: SealPayload | null } | { error: string } {
  if (d.kind === "khong") return { seal: null };
  if (d.kind === "trao-doi") return { seal: { kind: "trao-doi", question: d.question } };
  if (d.kind === "cau-do") {
    return {
      seal: { kind: "cau-do", question: d.question, answers: d.answers.map((r) => r.text), hints: d.hints.map((r) => r.text) },
    };
  }
  const t = d.opensAt === "" ? Number.NaN : new Date(d.opensAt).getTime();
  if (!Number.isFinite(t)) return { error: "Chọn ngày giờ mở." };
  return { seal: { kind: "hen-gio", opensAt: new Date(t).toISOString() } };
}

/** Gia tri cho o datetime-local (gio dia phuong, cat toi phut) cua mot thoi diem. */
export function localInputValue(d: Date): string {
  return `${d.getFullYear()}-${haiChuSo(d.getMonth() + 1)}-${haiChuSo(d.getDate())}T${haiChuSo(d.getHours())}:${haiChuSo(d.getMinutes())}`;
}

/**
 * id cac dong dap an co chu nhung chuan hoa ra rong (vd "?!"). parseSealInput chac chan tu choi cau do co
 * dong nhu vay (answers.includes("")), nen danh dau truoc khong bao gio chan mot cau do may chu nhan. Dong
 * chi co khoang trang thi may chu bo qua, o day cung bo qua. Dung chung normalizeAnswer, khong viet lai luat.
 */
export function blankAnswerIds(d: SealDraft): ReadonlySet<number> {
  if (d.kind !== "cau-do") return new Set();
  return new Set(d.answers.filter((r) => r.text.trim() !== "" && normalizeAnswer(r.text) === "").map((r) => r.id));
}

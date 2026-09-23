import type { TestDb } from "./db";
import { to } from "./library";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import type { SealInput } from "@/lib/seal/types";

export const GOI_Y = ["Có xe khách", "Ở phía đông", "Chữ đầu là B"] as const;

export const CAU_DO: SealInput = {
  kind: "cau-do", question: "Mình gặp nhau ở đâu?", answers: ["ben xe mien dong"], hints: [...GOI_Y],
};

export const TRAO_DOI: SealInput = { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" };

export const henGio = (opensAt: Date): SealInput => ({ kind: "hen-gio", opensAt });

/** Dang cac to kem mot niem phong, qua dung duong that: luu nhap roi dang. */
export async function dangNiemPhong(db: TestDb, ownerId: string, bookId: string, seal: SealInput, ...chu: string[]) {
  await saveDraft(db, ownerId, bookId, to(chu[0]), chu.length);
  const r = await publishDraft(db, ownerId, bookId, chu.map(to), seal);
  if (!r || r === "invalid-cover") throw new Error("khong dang duoc");
  return r;
}

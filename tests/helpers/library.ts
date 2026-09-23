import { seedHai } from "./seed";
import type { TestDb } from "./db";
import { createBook } from "@/server/library/books";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import type { DocJson } from "@/lib/doc/types";

/** Tai lieu mot doan chu. */
export const to = (chu: string): DocJson => ({
  type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: chu }] }],
});

/** Hai cho ngoi; seat1 co mot cuon chia se va mot cuon rieng tu. */
export async function haiCuon() {
  const s = await seedHai();
  const chung = await createBook(s.db, s.seat1.id, { title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
  const rieng = await createBook(s.db, s.seat1.id, { title: "Cuốn không đặt tên", mode: "rieng-tu", cover: "chim-bay", youtubeId: null, coverMediaId: null });
  return { ...s, chung, rieng };
}

/** Dang cac to vao mot cuon qua dung duong that: luu nhap roi dang. */
export async function dang(db: TestDb, ownerId: string, bookId: string, ...chu: string[]) {
  await saveDraft(db, ownerId, bookId, to(chu[0]), chu.length);
  const r = await publishDraft(db, ownerId, bookId, chu.map(to));
  if (!r || r === "invalid-cover") throw new Error("khong dang duoc");
  return r;
}

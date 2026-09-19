import { describe, it, expect } from "vitest";
import { COVERS, MODES, TITLE_MAX, parseBookInput } from "@/lib/book";
import { YOUTUBE_LINK_ERROR } from "@/lib/youtube";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseBookInput", () => {
  it("nhan form dung, cat va gop khoang trang trong ten", () => {
    expect(parseBookInput(form({ title: "  Chuyện   chưa kể ", mode: "chia-se", cover: "nui-xa" })))
      .toEqual({ title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
  });

  it("ten dung tran thi nhan, qua tran thi bao loi", () => {
    expect(parseBookInput(form({ title: "a".repeat(TITLE_MAX), mode: "rieng-tu", cover: "chim-bay" }))).not.toHaveProperty("error");
    expect(parseBookInput(form({ title: "a".repeat(TITLE_MAX + 1), mode: "rieng-tu", cover: "chim-bay" })))
      .toEqual({ error: "Tên sách phải từ 1 tới 60 ký tự." });
  });

  it("ten rong hoac chi khoang trang thi bao loi", () => {
    expect(parseBookInput(form({ title: "   ", mode: "chia-se", cover: "nui-xa" })))
      .toEqual({ error: "Tên sách phải từ 1 tới 60 ký tự." });
  });

  it("che do va bia ngoai danh sach thi bao loi", () => {
    expect(parseBookInput(form({ title: "A", mode: "cong-khai", cover: "nui-xa" }))).toEqual({ error: "Chọn một chế độ cho cuốn sách." });
    expect(parseBookInput(form({ title: "A", mode: "chia-se", cover: "anh" }))).toEqual({ error: "Chọn một bìa cho cuốn sách." });
    expect(parseBookInput(form({ title: "A" }))).toEqual({ error: "Chọn một chế độ cho cuốn sách." });
  });

  it("danh sach dung muoi bia va hai che do da dinh", () => {
    expect(COVERS).toEqual([
      "nui-xa", "khom-truc", "trang-nuoc", "chim-bay", "hoa-dao", "doi-chim", "thuyen-trang", "cau-go", "doi-thong", "meo-mai",
    ]);
    expect(MODES).toEqual(["chia-se", "rieng-tu"]);
  });

  it("o nhac nen: link dung thi giu ma video, rong hoac thieu thi khong co nhac, sai thi bao loi", () => {
    const dung = { title: "A", mode: "chia-se", cover: "nui-xa" };
    expect(parseBookInput(form({ ...dung, music: " https://www.youtube.com/watch?v=5qap5aO4i9A&t=42 " })))
      .toEqual({ ...dung, youtubeId: "5qap5aO4i9A", coverMediaId: null });
    expect(parseBookInput(form({ ...dung, music: "   " }))).toEqual({ ...dung, youtubeId: null, coverMediaId: null });
    expect(parseBookInput(form(dung))).toEqual({ ...dung, youtubeId: null, coverMediaId: null });
    expect(parseBookInput(form({ ...dung, music: "https://youtube.com/@linh" }))).toEqual({ error: YOUTUBE_LINK_ERROR });
    expect(YOUTUBE_LINK_ERROR).toBe("Link YouTube chưa đúng.");
  });

  it("o bia tu tai len: rong hoac thieu thi null, uuid thi giu, chuoi khac thi bao loi nhu bia sai", () => {
    const dung = { title: "A", mode: "chia-se", cover: "nui-xa" };
    const id = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
    expect(parseBookInput(form({ ...dung, coverMedia: id }))).toEqual({ ...dung, youtubeId: null, coverMediaId: id });
    expect(parseBookInput(form({ ...dung, coverMedia: "" }))).toEqual({ ...dung, youtubeId: null, coverMediaId: null });
    expect(parseBookInput(form({ ...dung, coverMedia: "anh-cua-em" }))).toEqual({ error: "Chọn một bìa cho cuốn sách." });
  });

  it("ten sai duoc bao truoc link nhac sai", () => {
    expect(parseBookInput(form({ title: "", mode: "chia-se", cover: "nui-xa", music: "sai" })))
      .toEqual({ error: "Tên sách phải từ 1 tới 60 ký tự." });
  });

  it("ten co ky tu Postgres khong luu duoc thi bao loi nhu ten sai do dai", () => {
    expect(parseBookInput(form({ title: `A${String.fromCharCode(0)}`, mode: "chia-se", cover: "nui-xa" })))
      .toEqual({ error: `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.` });
  });
});

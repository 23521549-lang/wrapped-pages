import { describe, expect, it } from "vitest";
import { parseBookEdit, TITLE_MAX } from "@/lib/book";
import { YOUTUBE_LINK_ERROR } from "@/lib/youtube";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const du = (them: Record<string, unknown> = {}) => ({ title: "Chuyện chưa kể", cover: "nui-xa", coverMedia: "", music: "", ...them });

describe("parseBookEdit", () => {
  it("nhan bon truong, gop khoang trang o ten, bo trong la khong co bia anh va khong co nhac", () => {
    expect(parseBookEdit(du({ title: "  Chuyện   chưa kể  " }))).toEqual({
      title: "Chuyện chưa kể", cover: "nui-xa", coverMediaId: null, youtubeId: null,
    });
  });

  it("doc ma video tu link YouTube va nhan bia tu tai len", () => {
    expect(parseBookEdit(du({ music: "https://youtu.be/dQw4w9WgXcQ", coverMedia: ID }))).toEqual({
      title: "Chuyện chưa kể", cover: "nui-xa", coverMediaId: ID, youtubeId: "dQw4w9WgXcQ",
    });
  });

  it("ten rong, ten qua dai, bia la, bia anh khong phai uuid, link nhac hong: deu la loi co chu", () => {
    const sai = [
      du({ title: "   " }),
      du({ title: "x".repeat(TITLE_MAX + 1) }),
      du({ title: `A${String.fromCharCode(0)}` }),
      du({ cover: "bia-khong-co-that" }),
      du({ coverMedia: "khong-phai-uuid" }),
      du({ music: "https://vi.wikipedia.org" }),
    ];
    for (const v of sai) expect(parseBookEdit(v), JSON.stringify(v)).toHaveProperty("error");
  });

  it("khong phai doi tuong, thieu truong, hay truong khong phai chuoi deu la loi, khong nem", () => {
    for (const v of [null, undefined, "chuoi", 7, [], {}, du({ title: 9 }), du({ music: null }), du({ coverMedia: 1 })]) {
      expect(parseBookEdit(v), JSON.stringify(v)).toHaveProperty("error");
    }
  });

  it("khong nhan che do sach: che do thua bi bo qua, khong lot vao ket qua", () => {
    expect(parseBookEdit(du({ mode: "rieng-tu" }))).toEqual({
      title: "Chuyện chưa kể", cover: "nui-xa", coverMediaId: null, youtubeId: null,
    });
  });

  it("dung chung cau loi voi form sach, khong nghi ra cau moi", () => {
    expect(parseBookEdit(du({ title: "   " }))).toEqual({ error: `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.` });
    expect(parseBookEdit(du({ cover: "bia-khong-co-that" }))).toEqual({ error: "Chọn một bìa cho cuốn sách." });
    expect(parseBookEdit(du({ coverMedia: "khong-phai-uuid" }))).toEqual({ error: "Chọn một bìa cho cuốn sách." });
    expect(parseBookEdit(du({ music: "https://vi.wikipedia.org" }))).toEqual({ error: YOUTUBE_LINK_ERROR });
  });
});

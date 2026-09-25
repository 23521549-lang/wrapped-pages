import { describe, it, expect } from "vitest";
import { COVERS, MODES, TITLE_MAX, parseBookInput, parseBookSettings, parseTrimInput } from "@/lib/book";
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

  it("che do sai duoc bao truoc ten sai: che do la truong rieng cua form sach, kiem truoc bo luat chung", () => {
    expect(parseBookInput(form({ title: "", mode: "cong-khai", cover: "nui-xa" }))).toEqual({ error: "Chọn một chế độ cho cuốn sách." });
  });

  it("ten co ky tu Postgres khong luu duoc thi bao loi nhu ten sai do dai", () => {
    expect(parseBookInput(form({ title: `A${String.fromCharCode(0)}`, mode: "chia-se", cover: "nui-xa" })))
      .toEqual({ error: `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.` });
  });
});

/*
 * Phan quyet B2 cua dot 24.09: "o bia va o nhac ROI KHOI phan tren cua Sua sach, chuyen han xuong hai muc danh sach.
 * Ly do: giu ca hai la hai duong ghi cho cung mot gia tri." Form Sua sach chi con hai truong, va bo luat cua ten phai y
 * het form tao, neu khong thi cung mot cai ten duoc nhan o man nay va bi tu choi o man kia.
 */
describe("parseBookSettings", () => {
  it("chi lay ten va che do, bo qua moi truong thua con sot lai tren form", () => {
    expect(parseBookSettings(form({ title: "  Chuyện   chưa kể ", mode: "chia-se", cover: "hoa-dao", coverMedia: "x", music: "sai" })))
      .toEqual({ title: "Chuyện chưa kể", mode: "chia-se" });
  });

  it("che do ngoai danh sach hoac thieu thi bao loi, va bao truoc ten sai", () => {
    expect(parseBookSettings(form({ title: "A", mode: "cong-khai" }))).toEqual({ error: "Chọn một chế độ cho cuốn sách." });
    expect(parseBookSettings(form({ title: "" }))).toEqual({ error: "Chọn một chế độ cho cuốn sách." });
  });

  it("ten rong, qua tran, hay co ky tu Postgres khong luu duoc: cung mot cau nhu form tao", () => {
    const sai = { error: `Tên sách phải từ 1 tới ${TITLE_MAX} ký tự.` };
    expect(parseBookSettings(form({ title: "   ", mode: "rieng-tu" }))).toEqual(sai);
    expect(parseBookSettings(form({ title: "a".repeat(TITLE_MAX + 1), mode: "rieng-tu" }))).toEqual(sai);
    expect(parseBookSettings(form({ title: `A${String.fromCharCode(0)}`, mode: "rieng-tu" }))).toEqual(sai);
    expect(parseBookSettings(form({ title: "a".repeat(TITLE_MAX), mode: "rieng-tu" }))).not.toHaveProperty("error");
  });
});

/*
 * Bo kiem cua trang Viet tiep. Khac parseBookInput o cho CA HAI o deu bo trong duoc: bo trong nghia la luot nay khong
 * them o nao va cuon giu nguyen bia voi nhac dang co.
 */
describe("parseTrimInput", () => {
  const ANH = "11111111-1111-4111-8111-111111111111";

  it("khong chon gi: ca hai o deu trong", () => {
    expect(parseTrimInput(form({ cover: "", coverMedia: "", music: "" })))
      .toEqual({ cover: null, coverMediaId: null, youtubeId: null, dropTrack: false });
  });

  it("thieu han cac truong cung la khong chon gi", () => {
    expect(parseTrimInput(new FormData()))
      .toEqual({ cover: null, coverMediaId: null, youtubeId: null, dropTrack: false });
  });

  it("chon mot tranh ve", () => {
    expect(parseTrimInput(form({ cover: "hoa-dao", coverMedia: "", music: "" })))
      .toEqual({ cover: "hoa-dao", coverMediaId: null, youtubeId: null, dropTrack: false });
  });

  it("chon mot anh trong kho: tranh du phong van di kem", () => {
    expect(parseTrimInput(form({ cover: "hoa-dao", coverMedia: ANH, music: "" })))
      .toEqual({ cover: "hoa-dao", coverMediaId: ANH, youtubeId: null, dropTrack: false });
  });

  it("co anh ma khong co tranh du phong bi tu choi, dung luat cua CHECK drafts_cover_media", () => {
    expect(parseTrimInput(form({ cover: "", coverMedia: ANH, music: "" }))).toEqual({ error: "Chọn một bìa cho cuốn sách." });
  });

  it("id anh khong phai uuid bi tu choi", () => {
    expect(parseTrimInput(form({ cover: "hoa-dao", coverMedia: "khong-phai-uuid", music: "" })))
      .toEqual({ error: "Chọn một bìa cho cuốn sách." });
  });

  it("tranh khong co that bi tu choi", () => {
    expect(parseTrimInput(form({ cover: "khong-co", coverMedia: "", music: "" }))).toEqual({ error: "Chọn một bìa cho cuốn sách." });
  });

  it("nhan link nhac dung va chi giu ma video", () => {
    expect(parseTrimInput(form({ cover: "", coverMedia: "", music: "https://youtu.be/dQw4w9WgXcQ" })))
      .toEqual({ cover: null, coverMediaId: null, youtubeId: "dQw4w9WgXcQ", dropTrack: false });
  });

  it("link nhac hong bi tu choi bang chinh cau cua parseYoutubeLink", () => {
    expect(parseTrimInput(form({ cover: "", coverMedia: "", music: "https://vi.wikipedia.org" })))
      .toEqual({ error: YOUTUBE_LINK_ERROR });
  });

  it("go nhac: khong di kem ma video", () => {
    expect(parseTrimInput(form({ cover: "", coverMedia: "", music: "", dropTrack: "1" })))
      .toEqual({ cover: null, coverMediaId: null, youtubeId: null, dropTrack: true });
  });

  it("vua go nhac vua dan link bi tu choi", () => {
    expect(parseTrimInput(form({ cover: "", coverMedia: "", music: "https://youtu.be/dQw4w9WgXcQ", dropTrack: "1" })))
      .toEqual({ error: "Bỏ dấu gỡ nhạc nếu bạn muốn dán một bản nhạc mới." });
  });

  it("moi tranh trong COVERS deu qua duoc", () => {
    for (const c of COVERS) expect(parseTrimInput(form({ cover: c, coverMedia: "", music: "" }))).not.toHaveProperty("error");
  });
});

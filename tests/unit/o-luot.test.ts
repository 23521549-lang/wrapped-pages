import { describe, expect, it } from "vitest";
import { COVER_NAME, cauOLuot, type TrimInput } from "@/lib/book";

const trong: TrimInput = { cover: null, coverMediaId: null, youtubeId: null, dropTrack: false };

/*
 * Cau nay thay cho muc gap "Doi bia, ten, nhac" da bo o buoc dang: buoc dang chi bao lai luot sap dang se them gi, con
 * doi thi o trang Viet tiep. Ham thuan nen kiem duoc tung to hop mot, khong phai dung ca man viet len.
 */
describe("cauOLuot", () => {
  it("khong chon gi", () => {
    expect(cauOLuot(trong)).toBe("Lượt này không thêm bìa hay nhạc.");
  });

  it("chi bia tranh ve, goi dung ten tranh", () => {
    expect(cauOLuot({ ...trong, cover: "hoa-dao" })).toBe(`Lượt này thêm bìa ${COVER_NAME["hoa-dao"]}.`);
  });

  it("bia la anh tu tai len thi goi la Anh cua ban, khong goi ten tranh du phong", () => {
    expect(cauOLuot({ ...trong, cover: "hoa-dao", coverMediaId: "x" })).toBe("Lượt này thêm bìa Ảnh của bạn.");
  });

  it("chi nhac", () => {
    expect(cauOLuot({ ...trong, youtubeId: "aaaaaaaaaaa" })).toBe("Lượt này thêm nhạc nền.");
  });

  it("chi go nhac", () => {
    expect(cauOLuot({ ...trong, dropTrack: true })).toBe("Lượt này gỡ nhạc nền.");
  });

  it("bia va nhac", () => {
    expect(cauOLuot({ ...trong, cover: "nui-xa", youtubeId: "aaaaaaaaaaa" }))
      .toBe(`Lượt này thêm bìa ${COVER_NAME["nui-xa"]} và nhạc nền.`);
  });

  it("bia va go nhac", () => {
    expect(cauOLuot({ ...trong, cover: "nui-xa", dropTrack: true }))
      .toBe(`Lượt này thêm bìa ${COVER_NAME["nui-xa"]} và gỡ nhạc nền.`);
  });

  it("khong cau nao co dau gach dai", () => {
    const moi: TrimInput[] = [
      trong,
      { ...trong, cover: "nui-xa" },
      { ...trong, cover: "nui-xa", coverMediaId: "x" },
      { ...trong, youtubeId: "aaaaaaaaaaa" },
      { ...trong, dropTrack: true },
      { ...trong, cover: "meo-mai", youtubeId: "aaaaaaaaaaa" },
      { ...trong, cover: "meo-mai", dropTrack: true },
    ];
    for (const t of moi) expect(cauOLuot(t)).not.toContain("—");
  });

  it("moi cau deu ket thuc bang dau cham va bat dau bang Luot nay", () => {
    for (const t of [trong, { ...trong, cover: "cau-go" as const }, { ...trong, dropTrack: true }]) {
      expect(cauOLuot(t).startsWith("Lượt này ")).toBe(true);
      expect(cauOLuot(t).endsWith(".")).toBe(true);
    }
  });
});

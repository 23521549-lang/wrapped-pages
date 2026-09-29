import { describe, it, expect } from "vitest";
import { feedLine, type FeedLine } from "@/lib/feed/line";
import { FEED_KINDS, type FeedActor, type FeedItem, type FeedKind } from "@/lib/feed/types";
import type { SealKind } from "@/lib/seal/types";
import { DONG_MAC_DINH } from "../helpers/feed";

const SACH = "11111111-1111-4111-8111-111111111111";
const TEN = { partner: "Linh", baiHat: { dQw4w9WgXcQ: { ten: "Nàng Thơ", kenh: "Hoàng Dũng" }, "5qap5aO4i9A": { ten: "Lofi", kenh: null } } };
const MOT_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
let dem = 0;

const NIEM_PHONG: Record<FeedKind, SealKind | null> = {
  "dang-trang": null, "moi-trao-doi": "trao-doi", "mo-hen-gio": "hen-gio", "mo-trang": "cau-do", "thu-sai": "cau-do",
  "tang-khoa": "cau-do", "doi-mat-khau": null, "hoi-dap": null, "tha-tam-trang": null, "tao-sach": null,
  "doi-ten-sach": null, "doi-bia": null, "doi-nhac": null, "sua-trang": null, "da-doc": null,
};

/** Chi tiet dung hinh mac dinh cua bon loai co detail. */
const CHI_TIET: Partial<Record<FeedKind, unknown>> = {
  "doi-ten-sach": { truoc: "Nhật ký chạy bộ", sau: "Chạy bộ mùa thu" },
  "doi-bia": { truoc: null, sau: { cover: "hoa-dao", anhId: null } },
  "doi-nhac": { truoc: null, sau: { youtubeId: "dQw4w9WgXcQ" } },
  "da-doc": { den: 6 },
};

/** Mot dong mau dung hinh cho moi loai: gan sach tru doi-mat-khau va tha-tam-trang, kieu niem phong theo loai. */
function su(kind: FeedKind, by: FeedActor, sua: Partial<FeedItem> = {}): FeedItem {
  dem += 1;
  const coSach = kind !== "doi-mat-khau" && kind !== "tha-tam-trang";
  const coLuot = coSach && kind !== "tao-sach" && kind !== "doi-ten-sach";
  return {
    ...DONG_MAC_DINH,
    id: `su-kien-${dem}`, kind, by, at: new Date("2026-09-15T08:00:00.000Z"),
    bookId: coSach ? SACH : null, bookTitle: coSach ? "Chuyện chưa kể" : null,
    firstPosition: coLuot ? 3 : null, lastPosition: coLuot ? 4 : null,
    sealKind: NIEM_PHONG[kind], note: null, count: 1,
    detail: CHI_TIET[kind] ?? null, weather: kind === "tha-tam-trang" ? "nang-am" : null, ...sua,
  };
}

/** Cau lien mot chuoi, doan dam boc trong ** de doc ro trong test. */
const cau = ({ sentence }: FeedLine) => sentence.map((d) => (d.dam ? `**${d.chu}**` : d.chu)).join("");
const HREF = `/sach/${SACH}?trang=3`;

describe("feedLine: cau cua tung loai cu, ca hai phia", () => {
  it.each<[string, FeedItem, string, string[]]>([
    ["dang-trang cua nguoi kia", su("dang-trang", "partner"), "Linh đăng 2 trang mới trong **Chuyện chưa kể**", []],
    ["dang-trang cua minh, mot to, kem cau do", su("dang-trang", "me", { lastPosition: 3, sealKind: "cau-do" }), "Bạn đăng 1 trang mới trong **Chuyện chưa kể**", ["Câu đố"]],
    ["dang-trang kem hen gio", su("dang-trang", "me", { sealKind: "hen-gio" }), "Bạn đăng 2 trang mới trong **Chuyện chưa kể**", ["Hẹn giờ"]],
    ["moi-trao-doi cua nguoi kia", su("moi-trao-doi", "partner"), "Linh mời bạn viết trang trả lời trong **Chuyện chưa kể**", ["Trao đổi"]],
    ["moi-trao-doi cua minh", su("moi-trao-doi", "me"), "Bạn mời Linh viết trang trả lời trong **Chuyện chưa kể**", ["Trao đổi"]],
    ["mo-hen-gio hai to", su("mo-hen-gio", "partner"), "Trang 3 tới 4 của **Chuyện chưa kể** đã tới giờ mở", ["Hẹn giờ"]],
    ["mo-hen-gio mot to", su("mo-hen-gio", "me", { lastPosition: 3 }), "Trang 3 của **Chuyện chưa kể** đã tới giờ mở", ["Hẹn giờ"]],
    ["mo-trang cau do cua nguoi kia", su("mo-trang", "partner"), "Linh mở được trang 3 tới 4 trong **Chuyện chưa kể**", ["Câu đố"]],
    ["mo-trang cau do cua minh", su("mo-trang", "me", { lastPosition: 3 }), "Bạn mở được trang 3 trong **Chuyện chưa kể**", ["Câu đố"]],
    ["mo-trang trao doi cua nguoi kia", su("mo-trang", "partner", { sealKind: "trao-doi", lastPosition: 3 }), "Linh gửi trang trả lời cho trang 3 trong **Chuyện chưa kể**", ["Trao đổi"]],
    ["mo-trang trao doi cua minh", su("mo-trang", "me", { sealKind: "trao-doi" }), "Bạn gửi trang trả lời cho trang 3 tới 4 trong **Chuyện chưa kể**", ["Trao đổi"]],
    ["thu-sai mot lan", su("thu-sai", "partner", { lastPosition: 3 }), "Linh thử trang 3 trong **Chuyện chưa kể**, chưa đúng", ["Câu đố"]],
    ["thu-sai gom hai lan", su("thu-sai", "partner", { lastPosition: 3, count: 2 }), "Linh thử trang 3 trong **Chuyện chưa kể**, chưa đúng", ["Câu đố", "2 lần"]],
    ["thu-sai cua minh", su("thu-sai", "me", { count: 5 }), "Bạn thử trang 3 tới 4 trong **Chuyện chưa kể**, chưa đúng", ["Câu đố", "5 lần"]],
    ["tang-khoa cua nguoi kia", su("tang-khoa", "partner", { lastPosition: 3 }), "Linh tặng bạn chìa khóa trang 3 trong **Chuyện chưa kể**", ["Câu đố"]],
    ["tang-khoa cua minh", su("tang-khoa", "me", { sealKind: "trao-doi" }), "Bạn tặng Linh chìa khóa trang 3 tới 4 trong **Chuyện chưa kể**", ["Trao đổi"]],
    ["hoi-dap cua nguoi kia", su("hoi-dap", "partner"), "Linh đã hồi đáp trang 3 tới 4 của **Chuyện chưa kể**", []],
    ["hoi-dap cua minh, mot to", su("hoi-dap", "me", { lastPosition: 3 }), "Bạn đã hồi đáp trang 3 của **Chuyện chưa kể**", []],
    ["sua-trang cua nguoi kia", su("sua-trang", "partner"), "Linh sửa trang 3 tới 4 của **Chuyện chưa kể**", []],
  ])("%s", (_ten, item, chu, chips) => {
    const line = feedLine(item, TEN);
    expect(cau(line)).toBe(chu);
    expect(line.chips).toEqual(chips);
    expect(line.href).toBe(HREF);
    expect(line.extra).toBeNull();
  });

  it("dang-trang kem bia moi va nhac moi: them hai nhan sau kieu niem phong", () => {
    const line = feedLine(su("dang-trang", "partner", { sealKind: "cau-do", biaMoi: true, nhacMoi: true }), TEN);
    expect(line.chips).toEqual(["Câu đố", "Bìa mới", "Nhạc mới"]);
  });

  it("o tron: nguoi lam theo by, rieng hen gio tu mo la dong ho", () => {
    expect(feedLine(su("dang-trang", "me"), TEN).avatar).toBe("me");
    expect(feedLine(su("mo-trang", "partner"), TEN).avatar).toBe("partner");
    expect(feedLine(su("mo-hen-gio", "me"), TEN).avatar).toBe("hen-gio");
    expect(feedLine(su("mo-hen-gio", "partner"), TEN).avatar).toBe("hen-gio");
  });

  it("tang-khoa kem loi nhan: loi nhan o dong phu, khong nam trong cau hay chip", () => {
    const line = feedLine(su("tang-khoa", "partner", { note: "Đoán mãi không ra thì thôi, em mở cho anh." }), TEN);
    expect(line.extra).toEqual({ kind: "loi-nhan", text: "Đoán mãi không ra thì thôi, em mở cho anh." });
    expect(cau(line)).not.toContain("Đoán");
    expect(line.chips).toEqual(["Câu đố"]);
  });

  it("mat khau bi doi: ca cau dam, dong phu noi dieu dung, khong lien ket", () => {
    expect(feedLine(su("doi-mat-khau", "partner"), TEN)).toEqual({
      sentence: [{ chu: "Linh vừa đổi mật khẩu của bạn", dam: true }],
      chips: [],
      extra: { kind: "ghi-chu", text: "Máy này vẫn đăng nhập. Hỏi Linh mật khẩu mới để vào ở máy khác." },
      href: null,
      avatar: "partner",
    });
  });

  it("minh doi mat khau cua nguoi kia: cau thuong, khong dong phu, khong lien ket", () => {
    expect(feedLine(su("doi-mat-khau", "me"), TEN)).toEqual({
      sentence: [{ chu: "Bạn đổi mật khẩu của Linh", dam: false }], chips: [], extra: null, href: null, avatar: "me",
    });
  });
});

describe("feedLine: bay loai cua dot nam", () => {
  it("tha tam trang: ten troi dam, loi nhan o dong phu, bam toi Lich hoa", () => {
    const line = feedLine(su("tha-tam-trang", "partner", { note: "Nay chạy được 5 cây." }), TEN);
    expect(cau(line)).toBe("Linh thả tâm trạng **Nắng ấm**");
    expect(line.extra).toEqual({ kind: "loi-nhan", text: "Nay chạy được 5 cây." });
    expect(line.href).toBe("/tam-trang");
    expect(cau(feedLine(su("tha-tam-trang", "me"), TEN))).toBe("Bạn thả tâm trạng **Nắng ấm**");
  });

  it("tao sach va doi ten: bam toi cuon; doi ten co hai phan dam", () => {
    const tao = feedLine(su("tao-sach", "partner"), TEN);
    expect(cau(tao)).toBe("Linh tạo cuốn **Chuyện chưa kể**");
    expect(tao.href).toBe(`/sach/${SACH}`);
    const ten = feedLine(su("doi-ten-sach", "partner"), TEN);
    expect(cau(ten)).toBe("Linh đổi tên **Nhật ký chạy bộ** thành **Chạy bộ mùa thu**");
    expect(ten.href).toBe(`/sach/${SACH}`);
    expect(cau(feedLine(su("doi-ten-sach", "me", { detail: { sau: "x" } }), TEN))).toBe("Bạn đổi tên cuốn **Chuyện chưa kể**");
  });

  it.each<[string, Partial<FeedItem>, string, string[]]>([
    ["tranh o luot 2", { ordinal: 2 }, "Linh đổi bìa lượt 2 của **Chuyện chưa kể**", ["Cành hoa đào"]],
    ["anh o mo dau", { detail: { truoc: null, sau: { cover: "nui-xa", anhId: "33333333-3333-4333-8333-333333333333" } } }, "Linh đổi bìa lúc tạo sách của **Chuyện chưa kể**", ["Ảnh của Linh"]],
    ["giu bia truoc", { ordinal: 3, detail: { truoc: { cover: "nui-xa", anhId: null }, sau: null } }, "Linh đổi bìa lượt 3 của **Chuyện chưa kể**", ["Giữ bìa trước"]],
    ["chi tiet la", { ordinal: 1, detail: { sau: 1 } }, "Linh đổi bìa lượt 1 của **Chuyện chưa kể**", []],
  ])("doi bia: %s", (_ten, sua, chu, chips) => {
    const line = feedLine(su("doi-bia", "partner", sua), TEN);
    expect(cau(line)).toBe(chu);
    expect(line.chips).toEqual(chips);
    expect(line.href).toBe(`/sach/${SACH}`);
  });

  it("doi bia bang anh cua chinh minh: Ảnh của bạn", () => {
    expect(feedLine(su("doi-bia", "me", { detail: { truoc: null, sau: { cover: "nui-xa", anhId: "33333333-3333-4333-8333-333333333333" } } }), TEN).chips).toEqual(["Ảnh của bạn"]);
  });

  it.each<[string, unknown, string[]]>([
    ["bai co kenh", { truoc: null, sau: { youtubeId: "dQw4w9WgXcQ" } }, ["Nàng Thơ, Hoàng Dũng"]],
    ["bai khong kenh", { truoc: null, sau: { youtubeId: "5qap5aO4i9A" } }, ["Lofi"]],
    ["bai chua lay duoc ten", { truoc: null, sau: { youtubeId: "aaaaaaaaaaa" } }, ["Bản nhạc trên YouTube"]],
    ["tat nhac", { truoc: null, sau: { youtubeId: null } }, ["Tắt nhạc"]],
    ["phat tiep", { truoc: { youtubeId: null }, sau: null }, ["Phát tiếp bài trước"]],
  ])("doi nhac: %s, bam toi Dau thoi gian cua cuon", (_ten, detail, chips) => {
    const line = feedLine(su("doi-nhac", "partner", { ordinal: 1, detail }), TEN);
    expect(cau(line)).toBe("Linh đổi nhạc lượt 1 của **Chuyện chưa kể**");
    expect(line.chips).toEqual(chips);
    expect(line.href).toBe(`/dau-thoi-gian/${SACH}`);
  });

  it("da doc: trang xa nhat, bam mo dung trang do", () => {
    const line = feedLine(su("da-doc", "partner"), TEN);
    expect(cau(line)).toBe("Linh đã đọc tới trang 6 của **Chuyện chưa kể**");
    expect(line.href).toBe(`/sach/${SACH}?trang=6`);
  });
});

describe("feedLine: bat bien cua moi dong", () => {
  const moiDong = FEED_KINDS.flatMap((kind) => (["me", "partner"] as const).map((by) => su(kind, by)));

  it("moi loai o ca hai phia deu co cau khong rong, bat dau bang chu hoa", () => {
    for (const item of moiDong) {
      const chu = cau(feedLine(item, TEN));
      expect(chu.length, `${item.kind} ${item.by}`).toBeGreaterThan(0);
      expect(chu.charAt(0), `${item.kind} ${item.by}`).toBe(chu.charAt(0).toLocaleUpperCase("vi"));
    }
  });

  it("dong ra khong co id nao ngoai id sach trong lien ket, ke ca id su kien", () => {
    for (const item of moiDong) {
      const line = feedLine(item, TEN);
      const ids = JSON.stringify(line).match(MOT_UUID) ?? [];
      const khongSach = item.kind === "doi-mat-khau" || item.kind === "tha-tam-trang";
      expect(ids, `${item.kind} ${item.by}`).toEqual(khongSach ? [] : [SACH]);
      expect(JSON.stringify(line)).not.toContain(item.id);
    }
  });

  it("su kien gan sach ma thieu sach thi nem loi, khong ve mot cau thieu", () => {
    expect(() => feedLine(su("dang-trang", "me", { bookTitle: null }), TEN)).toThrow("thieu sach");
    expect(() => feedLine(su("sua-trang", "me", { firstPosition: null }), TEN)).toThrow("thieu sach");
  });
});

import { describe, it, expect } from "vitest";
import { feedLine, type FeedLine } from "@/lib/feed/line";
import { FEED_KINDS, type FeedActor, type FeedItem } from "@/lib/feed/types";

const SACH = "11111111-1111-4111-8111-111111111111";
const TEN = { partner: "Linh" };
const MOT_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
let dem = 0;

/** Mot dong mau dung hinh cho moi loai: gan sach tru doi-mat-khau, kieu niem phong theo loai. */
function su(kind: FeedItem["kind"], by: FeedActor, sua: Partial<FeedItem> = {}): FeedItem {
  dem += 1;
  const coSach = kind !== "doi-mat-khau";
  const sealKind = { "dang-trang": null, "moi-trao-doi": "trao-doi", "mo-hen-gio": "hen-gio", "mo-trang": "cau-do", "thu-sai": "cau-do", "tang-khoa": "cau-do", "doi-mat-khau": null, "hoi-dap": null } as const;
  return {
    id: `su-kien-${dem}`, kind, by, at: new Date("2026-09-15T08:00:00.000Z"),
    bookId: coSach ? SACH : null, bookTitle: coSach ? "Chuyện chưa kể" : null,
    firstPosition: coSach ? 3 : null, lastPosition: coSach ? 4 : null,
    sealKind: sealKind[kind], note: null, count: 1, ...sua,
  };
}

/** Cau lien mot chuoi, doan dam boc trong ** de doc ro trong test. */
const cau = ({ sentence: s }: FeedLine) => `${s.before}${s.strong === "" ? "" : `**${s.strong}**`}${s.after}`;
const HREF = `/sach/${SACH}?trang=3`;

describe("feedLine: cau cua tung loai, ca hai phia", () => {
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
  ])("%s", (_ten, item, chu, chips) => {
    const line = feedLine(item, TEN);
    expect(cau(line)).toBe(chu);
    expect(line.chips).toEqual(chips);
    expect(line.href).toBe(HREF);
    expect(line.extra).toBeNull();
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
      sentence: { before: "", strong: "Linh vừa đổi mật khẩu của bạn", after: "" },
      chips: [],
      extra: { kind: "ghi-chu", text: "Máy này vẫn đăng nhập. Hỏi Linh mật khẩu mới để vào ở máy khác." },
      href: null,
      avatar: "partner",
    });
  });

  it("minh doi mat khau cua nguoi kia: cau thuong, khong dong phu, khong lien ket", () => {
    expect(feedLine(su("doi-mat-khau", "me"), TEN)).toEqual({
      sentence: { before: "Bạn đổi mật khẩu của Linh", strong: "", after: "" }, chips: [], extra: null, href: null, avatar: "me",
    });
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
      expect(ids, `${item.kind} ${item.by}`).toEqual(item.kind === "doi-mat-khau" ? [] : [SACH]);
      expect(JSON.stringify(line)).not.toContain(item.id);
    }
  });

  it("su kien gan sach ma thieu sach thi nem loi, khong ve mot cau thieu", () => {
    expect(() => feedLine(su("dang-trang", "me", { bookTitle: null }), TEN)).toThrow("thieu sach");
  });
});

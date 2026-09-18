// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import type { FeedItem } from "@/lib/feed/types";

const NOW = new Date("2026-09-15T15:00:00+07:00");
const SACH = "11111111-1111-4111-8111-111111111111";
const MAT_KHAU: Partial<FeedItem> = { kind: "doi-mat-khau", bookId: null, bookTitle: null, firstPosition: null, lastPosition: null };
let dem = 0;

/** Mot dong mau: trang moi cua nguoi kia luc NOW, tru khi sua. */
function su(sua: Partial<FeedItem> = {}): FeedItem {
  dem += 1;
  return {
    id: `su-kien-${dem}`, kind: "dang-trang", by: "partner", at: NOW,
    bookId: SACH, bookTitle: "Chuyện chưa kể", firstPosition: 1, lastPosition: 2,
    sealKind: null, note: null, count: 1, ...sua,
  };
}

const ve = (items: FeedItem[]) => render(<ActivityPanel items={items} now={NOW} myName="Mạnh" partnerName="Linh" />);

afterEach(() => {
  cleanup();
});

describe("ActivityPanel: chua co gi", () => {
  it("tieu de, o trong goi ten nguoi kia, khong co vung cuon hay phan tu nhan focus nao", () => {
    const { container } = ve([]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Hoạt động");
    expect(container.querySelector(".hoat-dong__trong b")?.textContent).toBe("Chưa có gì mới");
    expect(container.querySelector(".hoat-dong__trong .meta")?.textContent).toBe("Linh đăng trang hay mở một trang khóa thì tin hiện ở đây.");
    expect(screen.queryByRole("region")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });
});

describe("ActivityPanel: co su kien", () => {
  it("vung cuon nhan focus bang phim, co vai tro region va nhan", () => {
    const { container } = ve([su()]);
    const vung = screen.getByRole("region", { name: "Hoạt động gần đây" });
    expect(vung.getAttribute("tabindex")).toBe("0");
    expect(vung.className).toBe("hoat-dong__cuon");
    expect(container.querySelector(".hoat-dong__trong")).toBeNull();
  });

  it("moi ngay mot nhom co h3 va ol rieng, dung thu tu ngay", () => {
    const { container } = ve([
      su({ at: new Date("2026-09-15T14:00:00+07:00") }),
      su({ at: new Date("2026-09-15T08:00:00+07:00") }),
      su({ at: new Date("2026-09-14T21:00:00+07:00") }),
      su({ at: new Date("2026-09-04T09:30:00+07:00") }),
    ]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Hôm nay", "Hôm qua", "04.09"]);
    const nhom = Array.from(container.querySelectorAll(".hoat-dong__cuon > .hoat-dong__nhom"));
    expect(nhom.map((n) => [n.querySelector("h3.hoat-dong__ngay")?.textContent, n.querySelectorAll("ol.hoat-dong__ds > li").length]))
      .toEqual([["Hôm nay", 2], ["Hôm qua", 1], ["04.09", 1]]);
  });

  it("dong co sach la mot lien ket phu ca dong toi dung to; dong mat khau la khoi thuong, khong lien ket", () => {
    const { container } = ve([su({ firstPosition: 3, lastPosition: 4 }), su({ ...MAT_KHAU, at: new Date("2026-09-15T14:00:00+07:00") })]);
    const [coSach, matKhau] = Array.from(container.querySelectorAll("li"));
    const link = within(coSach).getByRole("link", { name: /^Linh đăng 2 trang mới trong Chuyện chưa kể/ });
    expect(coSach.children).toHaveLength(1);
    expect(link.tagName).toBe("A");
    expect(link.className).toBe("hoat-dong__dong");
    expect(link.getAttribute("href")).toBe(`/sach/${SACH}?trang=3`);
    expect(link.querySelector(".hoat-dong__chu b")?.textContent).toBe("Chuyện chưa kể");

    expect(within(matKhau).queryByRole("link")).toBeNull();
    const khoi = matKhau.querySelector("div.hoat-dong__dong");
    expect(khoi?.querySelector(".hoat-dong__chu b")?.textContent).toBe("Linh vừa đổi mật khẩu của bạn");
    expect(khoi?.querySelector(".hoat-dong__ghi")?.textContent).toBe("Máy này vẫn đăng nhập. Hỏi Linh mật khẩu mới để vào ở máy khác.");
  });

  it("gio la the time mang datetime ISO, chu la gio phut Viet Nam", () => {
    const { container } = ve([su({ at: new Date("2026-09-15T07:41:00+07:00") })]);
    const time = container.querySelector("time.hoat-dong__gio");
    expect(time?.getAttribute("datetime")).toBe("2026-09-15T00:41:00.000Z");
    expect(time?.textContent).toBe("07:41");
  });

  it("o tron an voi trinh doc man hinh: chu cai dau cua nguoi lam, dong ho khi hen gio tu mo", () => {
    const { container } = ve([su({ by: "me" }), su(), su({ kind: "mo-hen-gio", sealKind: "hen-gio" })]);
    const av = Array.from(container.querySelectorAll(".av"));
    expect(av.map((a) => [a.className, a.getAttribute("aria-hidden"), a.textContent])).toEqual([
      ["av", "true", "M"], ["av", "true", "L"], ["av av--he", "true", ""],
    ]);
    expect(av[2].querySelector("svg")).not.toBeNull();
  });

  it("chip o dong phu; loi nhan tang chia khoa co tien to cho trinh doc man hinh", () => {
    const { container } = ve([
      su({ kind: "thu-sai", sealKind: "cau-do", count: 2 }),
      su({ kind: "tang-khoa", sealKind: "cau-do", note: "Cho em nè" }),
    ]);
    const [thuSai, tang] = Array.from(container.querySelectorAll("li"));
    expect(Array.from(thuSai.querySelectorAll(".hoat-dong__phu .chip")).map((c) => c.textContent)).toEqual(["Câu đố", "2 lần"]);
    expect(thuSai.querySelector(".hoat-dong__ghi")).toBeNull();
    const ghi = tang.querySelector(".hoat-dong__ghi.hoat-dong__ghi--loi-nhan");
    expect(ghi?.textContent).toBe("Lời nhắn: Cho em nè");
    expect(ghi?.querySelector(".sr-only")?.textContent).toBe("Lời nhắn: ");
  });
});

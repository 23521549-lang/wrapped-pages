import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { LichDau, type DauHien } from "@/components/dau-thoi-gian/LichDau";
import { MayPhatChung } from "@/components/music/MayPhatChung";
import { YT_HOST, YT_STATE, type YTNamespace, type YTPlayerOptions } from "@/components/music/youtubeApi";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/*
 * Trang Dau thoi gian chi con nhac (chu du an 28/09): lich gon voi not nhac, cot phai la mot the gom ten ngay va Nhac
 * trong ngay phat tuan tu. Nhac chi tu phat khi bam mot ngay; bam lai ngay dang phat thi phat tiep; doi thang khong dung
 * toi nhac; ngay khac thi doi bai.
 */

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const D = "ddddddddddd";

/** YT.Player gia: thay moc bang mot iframe that, ghi lai moi lenh; su kien do bai kiem tu ban qua opts.events. */
class PlayerGia {
  readonly opts: YTPlayerOptions;
  readonly khung = document.createElement("iframe");
  readonly playVideo = vi.fn();
  readonly pauseVideo = vi.fn();
  readonly loadVideoById = vi.fn();
  readonly stopVideo = vi.fn();
  readonly destroy = vi.fn();

  constructor(el: HTMLElement, opts: YTPlayerOptions) {
    this.opts = opts;
    el.replaceWith(this.khung);
    cacMay.push(this);
  }

  getIframe() {
    return this.khung;
  }
}

const cacMay: PlayerGia[] = [];
const may = () => cacMay[cacMay.length - 1];
const san = () => act(() => may().opts.events.onReady({ target: may() }));
const bao = (data: number) => act(() => may().opts.events.onStateChange({ target: may(), data }));
const hong = () => act(() => may().opts.events.onError({ target: may(), data: 150 }));

const nhac = (key: string, luot: number, thang: string, ngay: number, youtubeId: string | null, ten: string | null = null, kenh: string | null = null): DauHien =>
  ({ key, luot: `luot-${luot}`, tenLuot: `Lượt ${luot}`, gio: "19:45", thang, ngay, youtubeId, ten, kenh });

/** Cuon tao ngay 5.8; thang 9 co: 15.9 ba luot (nhac A, go nhac, nhac B), 20.9 nhac C, 22.9 khong doi nhac. */
const DAU: DauHien[] = [
  nhac("n1", 1, "2026-08", 10, D, "Bài tháng tám", null),
  nhac("n2", 2, "2026-09", 15, A, "Never Gonna Give You Up", "Rick Astley"),
  nhac("n3", 3, "2026-09", 15, null),
  nhac("n4", 4, "2026-09", 15, B, null, null),
  nhac("n5", 5, "2026-09", 20, C, "Bài ngày hai mươi", "Kênh C"),
];

/** 12 gio trua 26.09.2026 gio Viet Nam. */
const NOW = new Date(Date.UTC(2026, 8, 26, 5));

async function ve(props: Partial<Parameters<typeof LichDau>[0]> = {}) {
  const kq = render(
    <MayPhatChung>
      <LichDau bookId="s1" dau={DAU} thangDau={{ y: 2026, m: 9 }} chonDau={22} tao={{ y: 2026, m: 8 }} thangNay={{ y: 2026, m: 9 }} homNay={26} now={NOW} {...props} />
    </MayPhatChung>,
  );
  // Promise nap API (window.YT da san) tao trinh phat trong mot vi tac vu.
  await act(async () => {});
  return kq;
}

const oNgay = (so: number, m = 9) => screen.getByRole("button", { name: new RegExp(`^${so} tháng ${m}\\.`) });
const bamNgay = async (so: number) => {
  fireEvent.click(oNgay(so));
  await act(async () => {});
};
const theNhac = () => screen.getByRole("region", { name: "Nhạc trong ngày" });
const dongDang = () => theNhac().querySelector(".dtg-nhac__chu")?.textContent;

beforeAll(() => {
  window.YT = { Player: PlayerGia } as unknown as YTNamespace;
});

beforeEach(() => {
  cacMay.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.history.replaceState(null, "", "/dau-thoi-gian/s1");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LichDau: lich gon", () => {
  it("dau lich: thang, dong tong dem lan doi nhac cua thang; thang nay thi nut Tháng sau tat", async () => {
    await ve();
    expect(screen.getByRole("heading", { level: 2, name: "Tháng 9, 2026" })).toBeTruthy();
    expect(document.querySelector(".thang__tong")?.textContent).toBe("4 lần đổi nhạc trong tháng");
    expect((screen.getByRole("button", { name: "Tháng sau" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Tháng trước" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ngay da qua la o bam duoc voi ten day du; ngay sau hom nay mo va khong bam duoc", async () => {
    await ve();
    expect(oNgay(15).getAttribute("aria-label")).toBe("15 tháng 9. 3 lần đổi nhạc");
    expect(oNgay(3).getAttribute("aria-label")).toBe("3 tháng 9. Không đổi nhạc");
    expect(oNgay(26).getAttribute("aria-label")).toBe("26 tháng 9. Không đổi nhạc. Hôm nay");
    expect(screen.queryByRole("button", { name: /^27 tháng 9/ })).toBeNull();
  });

  it("lich chi con mot lan nhac: moi lan doi nhac mot not, go nhac la not gach cheo; khong con bia", async () => {
    await ve();
    const not = [...oNgay(15).querySelectorAll(".dtg-not__mot")].map((c) => c.classList.contains("dtg-not__mot--go"));
    expect(not).toEqual([false, true, false]);
    expect(oNgay(20).querySelectorAll(".dtg-not__mot")).toHaveLength(1);
    expect(oNgay(3).querySelector(".dtg-trong")).not.toBeNull();
    expect(document.querySelector(".dtg-xap, .dtg-xl, .dtg-cham")).toBeNull();
    expect([...document.querySelectorAll(".tuan__nhan")].map((n) => n.textContent)).toContain("Nhạc");
    expect(document.body.textContent).not.toContain("Bìa");
  });

  it("ngay chon san: mot the gom ten ngay, cau tom tat va Nhac trong ngay; ngay khong doi nhac thi khong co trinh phat", async () => {
    await ve();
    expect(oNgay(22).getAttribute("aria-pressed")).toBe("true");
    const the = document.querySelector(".dtg-phu > .dtg-the") as HTMLElement;
    expect(the.querySelector(".dtg-ngay h2")?.textContent).toBe("Thứ Ba, 22.09");
    expect(the.querySelector(".dtg-ngay p")?.textContent).toBe("Ngày này không đổi nhạc.");
    expect(the.contains(theNhac())).toBe(true);
    expect(theNhac().textContent).toContain("Chọn một ngày có nốt nhạc trên lịch.");
    expect(cacMay).toHaveLength(0);
    expect(theNhac().querySelector(".dtg-nhac__may")).toBeNull();
    await bamNgay(15);
    expect(the.querySelector(".dtg-ngay p")?.textContent).toBe("3 lượt đăng, 3 lần đổi nhạc.");
  });

  it("doi thang ngay tai cho: tieu de va luoi doi, duong dan ghi ?thang, ngay dang chon va cot phai giu nguyen", async () => {
    await ve();
    fireEvent.click(screen.getByRole("button", { name: "Tháng trước" }));
    expect(screen.getByRole("heading", { level: 2, name: "Tháng 8, 2026" })).toBeTruthy();
    expect(window.location.search).toBe("?thang=2026-08");
    expect((screen.getByRole("button", { name: "Tháng trước" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector(".ngay[aria-pressed=true]")).toBeNull();
    expect(document.querySelector(".dtg-ngay h2")?.textContent).toBe("Thứ Ba, 22.09");
    // Thang 8 khong co ngay tuong lai.
    expect(oNgay(31, 8)).toBeTruthy();
  });
});

describe("LichDau: nhac trong ngay", () => {
  it("vua mo trang ma ngay chon san co nhac: tao trinh phat nocookie, KHONG tu phat", async () => {
    await ve({ chonDau: 15 });
    expect(cacMay).toHaveLength(1);
    expect(may().opts).toMatchObject({ host: YT_HOST, videoId: A, playerVars: { controls: 1, autoplay: 0, loop: 0 } });
    expect(may().khung.title).toBe("Trình phát nhạc");
    await san();
    expect(may().loadVideoById).not.toHaveBeenCalled();
    expect(may().playVideo).not.toHaveBeenCalled();
    expect(dongDang()).toBe("2 bài trong ngàyBấm Phát, hay chọn một bài.");
  });

  it("danh sach theo thu tu luot: ten bai va kenh; khong co ten thi cau thay; go nhac la dong khong bam duoc", async () => {
    await ve({ chonDau: 15 });
    const dong = within(theNhac()).getAllByRole("listitem");
    expect(dong.map((d) => d.textContent)).toEqual([
      "1Never Gonna Give You UpRick Astley. Lượt 2, lúc 19:45",
      "Gỡ nhạc nềnLượt 3, lúc 19:45. Từ lượt này cuốn im lặng.",
      "2Bản nhạc trên YouTubeLượt 4, lúc 19:45",
    ]);
    expect(dong[1].querySelector("button")).toBeNull();
  });

  it("bam mot ngay co nhac: phat tuan tu tu bai dau; het bai thi sang bai ke, bo qua go nhac; het danh sach thi dung", async () => {
    await ve();
    await bamNgay(15);
    expect(cacMay).toHaveLength(1);
    // Trinh phat vua tao chua san sang: bai dau duoc nho lai, san sang la phat. Trong luc do dong trang thai noi dang nap.
    expect(dongDang()).toBe("Never Gonna Give You UpĐang nạp, lượt 2");
    await san();
    expect(may().loadVideoById).toHaveBeenLastCalledWith(A);
    await bao(YT_STATE.PLAYING);
    expect(dongDang()).toBe("Never Gonna Give You UpĐang phát, lượt 2");
    expect(within(theNhac()).getByRole("button", { name: "Tạm dừng" })).toBeTruthy();
    expect(theNhac().querySelector("[aria-current='true']")?.textContent).toContain("Never Gonna Give You Up");
    await bao(YT_STATE.ENDED);
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B);
    await bao(YT_STATE.ENDED);
    expect(may().stopVideo).toHaveBeenCalled();
    expect(dongDang()).toBe("2 bài trong ngàyBấm Phát, hay chọn một bài.");
  });

  it("bai khong phat duoc thi bo qua, sang bai ke", async () => {
    await ve();
    await bamNgay(15);
    await san();
    await hong();
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B);
  });

  it("bam lai dung ngay dang phat: phat tiep, khong nap lai tu dau", async () => {
    await ve();
    await bamNgay(15);
    await san();
    await bao(YT_STATE.PLAYING);
    await bamNgay(15);
    expect(may().loadVideoById).toHaveBeenCalledTimes(1);
    expect(may().stopVideo).not.toHaveBeenCalled();
  });

  it("bam ngay khac co nhac: cung trinh phat nap bai dau cua ngay moi ngay trong cu bam; ngay khong co nhac thi dung va go trinh phat", async () => {
    await ve();
    await bamNgay(15);
    await san();
    await bamNgay(20);
    expect(cacMay).toHaveLength(1);
    expect(may().loadVideoById).toHaveBeenLastCalledWith(C);
    await bamNgay(22);
    expect(cacMay[0].stopVideo).toHaveBeenCalled();
    expect(cacMay[0].destroy).toHaveBeenCalled();
    expect(theNhac().querySelector(".dtg-nhac__may")).toBeNull();
  });

  it("doi thang khong dung toi nhac", async () => {
    await ve();
    await bamNgay(15);
    await san();
    await bao(YT_STATE.PLAYING);
    fireEvent.click(screen.getByRole("button", { name: "Tháng trước" }));
    await act(async () => {});
    expect(may().stopVideo).not.toHaveBeenCalled();
    expect(may().destroy).not.toHaveBeenCalled();
    expect(dongDang()).toBe("Never Gonna Give You UpĐang phát, lượt 2");
  });

  it("nut Phat luc chua phat bai nao thi phat bai dau; Tam dung va Phat tiep goi thang trinh phat; Bai ke tiep", async () => {
    await ve({ chonDau: 15 });
    await san();
    fireEvent.click(within(theNhac()).getByRole("button", { name: "Phát" }));
    expect(may().loadVideoById).toHaveBeenLastCalledWith(A);
    await bao(YT_STATE.PLAYING);
    fireEvent.click(within(theNhac()).getByRole("button", { name: "Tạm dừng" }));
    expect(may().pauseVideo).toHaveBeenCalledTimes(1);
    await bao(YT_STATE.PAUSED);
    expect(dongDang()).toBe("Never Gonna Give You UpTạm dừng, lượt 2");
    fireEvent.click(within(theNhac()).getByRole("button", { name: "Phát" }));
    expect(may().playVideo).toHaveBeenCalledTimes(1);
    fireEvent.click(within(theNhac()).getByRole("button", { name: "Bài kế tiếp" }));
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B);
    expect((within(theNhac()).getByRole("button", { name: "Bài kế tiếp" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("bam mot bai trong danh sach thi phat bai do", async () => {
    await ve({ chonDau: 15 });
    await san();
    fireEvent.click(within(theNhac()).getByRole("button", { name: /Bản nhạc trên YouTube/ }));
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B);
  });
});

describe("dau-thoi-gian.css", () => {
  const CSS = readFileSync("src/styles/dau-thoi-gian.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const giam = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));

  it("khung phat khong bao gio thap hon 200px", () => {
    expect(CSS).toMatch(/\.dtg-nhac__may\{[^}]*min-height: 200px/);
  });

  it("moi hoat anh va chuyen tiep moi deu co nhanh giam chuyen dong", () => {
    expect(giam.length).toBeGreaterThan(0);
    for (const chon of [".dtg-bai--chay .dtg-vach i", "button.dtg-bai"]) expect(giam).toContain(chon);
  });

  it("khong con CSS cua trinh xem bia hay xap bia lon", () => {
    expect(CSS).not.toMatch(/\.dtg-(xem|xl|the-bia|nhac-cho|cham|khong-bia)\b/);
  });

  it("mau va lop xep chong di qua token, khong ma mau viet tay", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/oklch\(/);
    for (const m of CSS.matchAll(/z-index:\s*([^;}]+)/g)) expect(m[1].trim()).toMatch(/^(var\(--z-[a-z-]+\)|[0-9])$/);
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { MayPhatChung } from "@/components/music/MayPhatChung";
import { YT_STATE, type YTNamespace, type YTPlayerOptions } from "@/components/music/youtubeApi";
import { SoNhac, type DanhSachHien } from "@/components/so-nhac/SoNhac";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/*
 * So nhac mot thang (5b, spec B3): cac danh sach phat canh nhau, nut tron tam giac phat tu bai dau (dang phat thi tam
 * dung), bam mot bai la phat tu bai do, bai dang phat co ba vach song thay so thu tu, dong dang phat duoi khung.
 */

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
const doi = () => act(async () => {});

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const DS: DanhSachHien[] = [
  { khoa: "kia", ten: "Của Mạnh", bai: [] },
  { khoa: "minh", ten: "Của Linh", bai: [
    { key: "1", youtubeId: A, ten: "Nàng thơ", kenh: "Hoàng Dũng", nguon: "Chuyện chưa kể, lượt 2" },
    { key: "2", youtubeId: B, ten: "Bản nhạc trên YouTube", kenh: null, nguon: "Góc riêng, lúc tạo sách, riêng tư" },
  ] },
];

async function ve(ds: DanhSachHien[] = DS) {
  render(<MayPhatChung><SoNhac thang="2026-09" href="/dau-thoi-gian/thang/2026-09" ds={ds} /></MayPhatChung>);
  await doi();
}

const dsCua = (ten: string) => screen.getByRole("region", { name: new RegExp(ten) });

beforeAll(() => {
  window.YT = { Player: PlayerGia } as unknown as YTNamespace;
});

beforeEach(() => {
  cacMay.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SoNhac", () => {
  it("moi danh sach mot vung: ten, so bai; danh sach rong khong co nut phat; bai: ten, kenh va nguon", async () => {
    await ve();
    expect(within(dsCua("Của Mạnh")).queryByRole("button")).toBeNull();
    expect(dsCua("Của Mạnh").textContent).toContain("Chưa đặt bài nào trong tháng");
    expect(dsCua("Của Linh").querySelector(".pl__ten span")?.textContent).toBe("2 bài trong tháng");
    expect([...dsCua("Của Linh").querySelectorAll(".bai")].map((b) => b.textContent)).toEqual([
      "1Nàng thơHoàng Dũng, Chuyện chưa kể, lượt 2",
      "2Bản nhạc trên YouTubeGóc riêng, lúc tạo sách, riêng tư",
    ]);
  });

  it("vua mo: khung lon nap san bai dau cua danh sach dau co bai, khong phat", async () => {
    await ve();
    expect(cacMay).toHaveLength(1);
    expect(may().opts.videoId).toBe(A);
    await san();
    expect(may().loadVideoById).not.toHaveBeenCalled();
    expect(document.querySelector(".sn__dang")?.textContent).toBe("");
  });

  it("tam giac phat tu bai dau; dang phat thi thanh tam dung; bai dang phat mang vach song va dong dang phat", async () => {
    await ve();
    await san();
    fireEvent.click(screen.getByRole("button", { name: "Phát Của Linh" }));
    expect(may().loadVideoById).toHaveBeenLastCalledWith(A);
    await bao(YT_STATE.PLAYING);
    const dang = dsCua("Của Linh").querySelector("[aria-current='true']") as HTMLElement;
    expect(dang.className).toBe("bai bai--dang bai--chay");
    expect(dang.querySelector(".song")).not.toBeNull();
    expect(document.querySelector(".sn__dang")?.textContent).toBe("Đang phát Nàng thơ, Hoàng Dũng. Của Linh, bài 1 trên 2.");
    expect(dsCua("Của Linh").className).toBe("pl pl--dang");
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng Của Linh" }));
    expect(may().pauseVideo).toHaveBeenCalledTimes(1);
    await bao(YT_STATE.PAUSED);
    fireEvent.click(screen.getByRole("button", { name: "Phát Của Linh" }));
    expect(may().playVideo).toHaveBeenCalledTimes(1);
  });

  it("bam mot bai la phat tu bai do; het bai cuoi thi dung", async () => {
    await ve();
    await san();
    fireEvent.click(screen.getByRole("button", { name: /Bản nhạc trên YouTube/ }));
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B);
    await bao(YT_STATE.PLAYING);
    expect(document.querySelector(".sn__dang")?.textContent).toBe("Đang phát Bản nhạc trên YouTube. Của Linh, bài 2 trên 2.");
    await bao(YT_STATE.ENDED);
    expect(may().stopVideo).toHaveBeenCalled();
    expect(dsCua("Của Linh").querySelector("[aria-current]")).toBeNull();
  });

  it("hai danh sach deu co bai: het danh sach nay sang danh sach kia", async () => {
    const hai: DanhSachHien[] = [{ ...DS[0], bai: [{ key: "3", youtubeId: C, ten: "Bài C", kenh: null, nguon: "Sách, lượt 1" }] }, DS[1]];
    await ve(hai);
    expect(may().opts.videoId).toBe(C);
    await san();
    fireEvent.click(screen.getByRole("button", { name: "Phát Của Linh" }));
    await bao(YT_STATE.ENDED);
    await bao(YT_STATE.ENDED);
    expect(may().loadVideoById).toHaveBeenLastCalledWith(C);
    await bao(YT_STATE.ENDED);
    expect(may().stopVideo).toHaveBeenCalled();
  });
});

describe("danh sach Hai Ngòi Bút (5c muc J)", () => {
  it("danh sach chung mang dau hai ngoi but, phat noi tiep sau hai danh sach rieng", async () => {
    await ve([...DS, { khoa: "chung", ten: "Hai Ngòi Bút", chung: true, bai: [
      { key: "3", youtubeId: C, ten: "Mùa thu cho em", kenh: "Ngọc Lễ", nguon: "Những bữa sáng, lượt 3, Linh đặt" },
    ] }]);
    const chung = dsCua("Hai Ngòi Bút");
    expect(chung.querySelector(".pl__ten .ngoi")).not.toBeNull();
    expect(within(chung).getByText("Ngọc Lễ, Những bữa sáng, lượt 3, Linh đặt")).toBeTruthy();
    expect(within(chung).getByRole("button", { name: "Phát Hai Ngòi Bút" })).toBeTruthy();
    expect(dsCua("Của Linh").querySelector(".ngoi")).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioBlock } from "@/components/media/AudioBlock";
import { ImageBlock } from "@/components/media/ImageBlock";
import { PEAK_COUNT } from "@/lib/media/kinds";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const PEAKS = Array.from({ length: PEAK_COUNT }, (_, i) => (i * 13) % 101);

/** jsdom khong phat am thanh: play va pause gia doi co paused va phat su kien nhu trinh duyet. */
function giaLapAmThanh() {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    if (this.paused) return;
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
  return { play, pause };
}

const ghiAm = (src = `/m/${ID}`) => <AudioBlock src={src} ms={84_000} peaks={PEAKS} author="Mạnh" />;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ImageBlock", () => {
  it("anh rong hon vung chu co ve 304, cao theo ti le, doc qua /m, chu thay the co ten nguoi dang", () => {
    const { container } = render(<ImageBlock id={ID} w={1200} h={900} author="Mạnh" />);
    const img = screen.getByRole("img", { name: "Ảnh Mạnh đăng" });
    expect([img.getAttribute("src"), img.getAttribute("width"), img.getAttribute("height"), img.getAttribute("loading")])
      .toEqual([`/m/${ID}`, "304", "228", "lazy"]);
    expect(img.parentElement).toBe(container.querySelector("figure.khoi-anh"));
  });

  it("anh hep hon vung chu giu dung co that, khong phong to", () => {
    render(<ImageBlock id={ID} w={200} h={300} author="Mạnh" />);
    const img = screen.getByRole("img");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["200", "300"]);
  });

  it("anh khong tai duoc thanh cho trong cung kich thuoc, van giu phan tu con", () => {
    const { container } = render(
      <ImageBlock id={ID} w={1200} h={900} author="Mạnh"><button type="button">Bỏ ảnh</button></ImageBlock>,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(container.querySelector("img")).toBeNull();
    const cho = container.querySelector("figure.khoi-anh--loi .khoi-anh__cho");
    expect([cho?.getAttribute("width"), cho?.getAttribute("height")]).toEqual(["304", "228"]);
    expect(screen.getByRole("figure", { name: "Ảnh Mạnh đăng, chưa tải được." }).textContent).toContain("Chưa tải được ảnh.");
    expect(screen.getByRole("button", { name: "Bỏ ảnh" })).not.toBeNull();
  });
});

describe("AudioBlock", () => {
  it("chua phat: nut Phat, nhan doc ca do dai, gio 0:00 tren tong, 48 cot song, khong tai truoc, khong tu phat", () => {
    const { container } = render(ghiAm());
    expect(screen.getByRole("figure", { name: "Mạnh ghi âm, dài 1:24" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Phát ghi âm" })).not.toBeNull();
    expect(container.querySelector(".khoi-ghi-am__gio")?.textContent).toBe("0:00 / 1:24");
    expect(container.querySelectorAll(".khoi-ghi-am__nen rect")).toHaveLength(PEAK_COUNT);
    expect(container.querySelectorAll(".khoi-ghi-am__da rect")).toHaveLength(PEAK_COUNT);
    expect(container.querySelector(".khoi-ghi-am__song defs rect")?.getAttribute("width")).toBe("0");
    const audio = container.querySelector("audio");
    expect([audio?.getAttribute("src"), audio?.getAttribute("preload"), audio?.hasAttribute("autoplay")]).toEqual([`/m/${ID}`, "none", false]);
  });

  it("bam thi phat, gio va phan song da nghe chay theo, bam lai thi tam dung", async () => {
    const { play, pause } = giaLapAmThanh();
    const { container } = render(ghiAm());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Phát ghi âm" }));
    });
    expect(play).toHaveBeenCalledTimes(1);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "currentTime", { configurable: true, value: 42 });
    fireEvent.timeUpdate(audio);
    expect(container.querySelector(".khoi-ghi-am__gio")?.textContent).toBe("0:42 / 1:24");
    expect(container.querySelector(".khoi-ghi-am__song defs rect")?.getAttribute("width")).toBe("96");
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng ghi âm" }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Phát ghi âm" })).not.toBeNull();
  });

  it("moi luc chi mot doan phat: doan sau bat dau thi doan truoc tam dung", async () => {
    const { pause } = giaLapAmThanh();
    render(<>{ghiAm("/m/a")}{ghiAm("/m/b")}</>);
    const [dau, sau] = screen.getAllByRole("button", { name: "Phát ghi âm" });
    await act(async () => {
      fireEvent.click(dau);
    });
    await act(async () => {
      fireEvent.click(sau);
    });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Phát ghi âm" })).toEqual([dau]);
    expect(screen.getAllByRole("button", { name: "Tạm dừng ghi âm" })).toEqual([sau]);
  });

  it("go ra khi dang phat (lat trang) thi tieng dung", async () => {
    const { pause } = giaLapAmThanh();
    const { unmount } = render(ghiAm());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Phát ghi âm" }));
    });
    unmount();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("tai hong thi thanh cho trong: van nhan va do dai, bo nut phat, giu phan tu con", () => {
    const { container } = render(
      <AudioBlock src={`/m/${ID}`} ms={84_000} peaks={PEAKS} author="Mạnh"><button type="button">Bỏ ghi âm</button></AudioBlock>,
    );
    fireEvent.error(container.querySelector("audio") as HTMLAudioElement);
    expect(screen.queryByRole("button", { name: "Phát ghi âm" })).toBeNull();
    expect(container.querySelector(".khoi-ghi-am--loi .khoi-ghi-am__loi")?.textContent).toBe("Chưa tải được ghi âm.");
    expect(container.querySelector(".khoi-ghi-am__nhan")?.textContent).toBe("Mạnh ghi âm");
    expect(container.querySelector(".khoi-ghi-am__gio")?.textContent).toBe("1:24");
    expect(screen.getByRole("button", { name: "Bỏ ghi âm" })).not.toBeNull();
  });

  it("play bi tu choi vi tep hong cung thanh cho trong", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("hong"));
    const { container } = render(ghiAm());
    Object.defineProperty(container.querySelector("audio"), "error", { configurable: true, value: { code: 4 } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Phát ghi âm" }));
    });
    expect(container.querySelector(".khoi-ghi-am__loi")?.textContent).toBe("Chưa tải được ghi âm.");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Editor } from "@/components/editor/Editor";
import type { DocJson } from "@/lib/doc/types";
import { IMAGE_SOURCE_MAX_BYTES } from "@/lib/media/image";
import { PEAK_COUNT } from "@/lib/media/kinds";
import { jpegDau, tepTu } from "../helpers/anh-mau";

/*
 * Them anh va ghi am o man viet tren Editor that. Trinh duyet gia: createImageBitmap va canvas cho anh;
 * getUserMedia, MediaRecorder va AudioContext cho ghi am. Dong ho gia cho dong ho ghi va hen gio tu an; setImmediate that
 * de React va TipTap chay binh thuong.
 */

const { actionUploadMedia } = vi.hoisted(() => ({ actionUploadMedia: vi.fn() }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia }));
vi.mock("@/app/actions/library", () => ({
  actionSaveDraft: vi.fn(async () => ({ savedAt: "2026-09-16T00:00:00.000Z" })),
  actionPublish: vi.fn(),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const SACH = "5d3a1c2b-8e7f-4a6b-9c0d-1e2f3a4b5c6d";
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const DOC: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Sáng" }] }] };
const SONG_MAY_CHU = Array.from({ length: PEAK_COUNT }, (_, i) => (i * 3) % 101);

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MediaRecorderGia {
  static isTypeSupported = vi.fn((mime: string) => mime === "audio/webm;codecs=opus");
  static tao: MediaRecorderGia[] = [];
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  /** Ham nghe su kien "error" da dang ky qua addEventListener (recording.ts dung addEventListener cho loi). */
  ngheLoi: (() => void)[] = [];

  constructor(_stream: unknown, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
    MediaRecorderGia.tao.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["am"], { type: "audio/webm" }) });
    this.onstop?.();
  }

  /**
   * Mo phong thiet bi mat giua chung (rut mic, mat quyen): dac ta dat state ve "inactive" ngay lap tuc trong thuat toan
   * dung, nhung su kien "stop" (va "dataavailable" cuoi) la mot task duoc xep hang, co the chua kip chay truoc khi nguoi
   * dung bam Huy hay roi trang. Ham nay chi doi state, KHONG goi ondataavailable/onstop, dung de dung dung khoang ho do.
   */
  tuNgung() {
    this.state = "inactive";
  }

  /**
   * Mo phong TRINH DUYET tu dung recorder (rut micro, mat quyen giua chung, cuoc goi den, he dieu hanh doi lai thiet
   * bi): khac tuNgung() o tren o cho day la luc cac su kien THAT SU chay - dac ta cho user agent ban dataavailable
   * cuoi roi ban stop, ma khong ai goi recorder.stop(). coDuLieu = false la truong hop khong con byte nao giu duoc.
   */
  trinhDuyetDung(coDuLieu = true) {
    if (this.state === "inactive") return;
    this.state = "inactive";
    if (coDuLieu) this.ondataavailable?.({ data: new Blob(["am"], { type: "audio/webm" }) });
    this.onstop?.();
  }

  addEventListener(ten: string, xu: () => void) {
    if (ten === "error") this.ngheLoi.push(xu);
  }

  /** Recorder bao loi: dac ta cho ban dataavailable cuoi, roi error, roi stop. */
  banLoi() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["am"], { type: "audio/webm" }) });
    for (const xu of this.ngheLoi) xu();
    this.onstop?.();
  }
}

/** Muc am co dinh: moi mau 192, tuc nua bien do. */
class AudioContextGia {
  createAnalyser() {
    return { fftSize: 0, getByteTimeDomainData: (mau: Uint8Array) => mau.fill(192) };
  }

  createMediaStreamSource() {
    return { connect: () => {} };
  }

  close() {
    return Promise.resolve();
  }
}

function giaLapMicro() {
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn(async (_c: MediaStreamConstraints) => ({ getTracks: () => [track] }));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { track, getUserMedia };
}

function giaLapAnh(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() };
  const createImageBitmap = vi.fn(async (_tep: Blob, _tuyChon?: ImageBitmapOptions) => bitmap);
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({ drawImage })) as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((goiLai: BlobCallback, type?: string) => {
    goiLai(new Blob(["anh"], { type }));
  });
  return { bitmap, createImageBitmap, drawImage };
}

/** Cho moi loi hua dang cho (xu ly anh, action, node view cua TipTap) chay xong. */
async function xong() {
  for (let i = 0; i < 10; i++) await act(async () => {});
}

async function veEditor(mediaEnabled = true) {
  const r = render(
    <Editor bookId={SACH} bookTitle="Những bữa sáng" partnerNickname="Linh" initialDoc={DOC} initialSavedAt={null} author="Mạnh" mediaEnabled={mediaEnabled} />,
  );
  await xong();
  return r;
}

async function chonTep(container: HTMLElement, tep: File) {
  const o = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!o) throw new Error("khong co o chon tep");
  fireEvent.change(o, { target: { files: [tep] } });
  await xong();
}

/** Chu cua dong tai anh, bo dau cham than trang tri. */
function dongTai(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".tai-anh__than p"), (p) => p.lastChild?.textContent ?? "");
}

const vungDoc = (container: HTMLElement) => container.querySelector(".viet > p.sr-only[aria-live]")?.textContent;
const khoiCapCao = (container: HTMLElement) =>
  Array.from(container.querySelector(".viet-chu .ProseMirror")?.children ?? [], (el) => el.classList.contains("node-anh") ? "anh" : el.classList.contains("node-ghi-am") ? "ghi-am" : el.tagName);

async function moGhiAm() {
  fireEvent.click(screen.getByRole("button", { name: "Ghi âm" }));
  await xong();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:gia"), revokeObjectURL: vi.fn() }));
  vi.stubGlobal("MediaRecorder", MediaRecorderGia);
  vi.stubGlobal("AudioContext", AudioContextGia);
  MediaRecorderGia.tao = [];
  MediaRecorderGia.isTypeSupported.mockImplementation((mime: string) => mime === "audio/webm;codecs=opus");
  actionUploadMedia.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("thanh cong cu man viet", () => {
  it("ten Cong cu viet, nhom Them vao trang dung giua nam nut dinh dang va Tap trung", async () => {
    await veEditor();
    const thanh = screen.getByRole("toolbar", { name: "Công cụ viết" });
    expect(within(thanh).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent))
      .toEqual(["Đậm", "Nghiêng", "Gạch chân", "Danh sách", "Trích dẫn", "Thêm ảnh", "Ghi âm", "Tập trung"]);
    const nhom = within(thanh).getByRole("group", { name: "Thêm vào trang" });
    expect(within(nhom).getAllByRole("button").map((b) => b.textContent)).toEqual(["Thêm ảnh", "Ghi âm"]);
    expect(screen.getByRole("button", { name: "Ghi âm" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Chưa bật kho lưu ảnh và ghi âm.")).toBeNull();
  });

  it("kho chua bat: hai nut mo di nhung van Tab toi duoc, doc kem cau ghi chu, bam khong lam gi", async () => {
    const moChonTep = vi.spyOn(HTMLInputElement.prototype, "click");
    await veEditor(false);
    const ghiChu = screen.getByText("Chưa bật kho lưu ảnh và ghi âm.");
    for (const ten of ["Thêm ảnh", "Ghi âm"]) {
      const nut = screen.getByRole("button", { name: ten }) as HTMLButtonElement;
      expect([nut.getAttribute("aria-disabled"), nut.disabled, nut.getAttribute("aria-describedby")], ten).toEqual(["true", false, ghiChu.id]);
      fireEvent.click(nut);
    }
    await xong();
    expect(moChonTep).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Ghi âm" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ghi âm" }).hasAttribute("aria-expanded")).toBe(false);
  });
});

describe("them anh", () => {
  it("xoay theo EXIF, ve lai rong 1200 bang WebP, gui len, chen khoi sau doan dang go, bao Da chen anh roi tu an", async () => {
    const { bitmap, createImageBitmap, drawImage } = giaLapAnh(4000, 3000);
    actionUploadMedia.mockResolvedValue({ id: ID, w: 1200, h: 900 });
    const { container } = await veEditor();
    const tep = tepTu(jpegDau(4000, 3000), "bua-sang.jpg", "image/jpeg");
    await chonTep(container, tep);

    expect(createImageBitmap).toHaveBeenCalledWith(tep, { imageOrientation: "from-image" });
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1200, 900);
    expect(bitmap.close).toHaveBeenCalled();
    const fd = actionUploadMedia.mock.calls[0][0] as FormData;
    expect([fd.get("kind"), fd.get("book"), (fd.get("file") as File).type]).toEqual(["anh", SACH, "image/webp"]);
    expect(khoiCapCao(container)).toEqual(["P", "anh", "P"]);
    const img = container.querySelector(".ProseMirror .node-anh img");
    expect([img?.getAttribute("src"), img?.getAttribute("width"), img?.getAttribute("height")]).toEqual([`/m/${ID}`, "304", "228"]);
    expect([dongTai(container), vungDoc(container)]).toEqual([["Đã chèn ảnh."], "Đã chèn ảnh."]);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(container.querySelector(".tai-anh")).toBeNull();
  });

  it("dang tai thi Them anh tam khoa; Huy bo ket qua, khong chen gi", async () => {
    giaLapAnh(800, 600);
    let traLoi: (r: unknown) => void = () => {};
    actionUploadMedia.mockImplementation(() => new Promise((ok) => {
      traLoi = ok;
    }));
    const moChonTep = vi.spyOn(HTMLInputElement.prototype, "click");
    const { container } = await veEditor();
    await chonTep(container, tepTu(jpegDau(800, 600), "a.jpg", "image/jpeg"));
    expect(dongTai(container)).toEqual(["Đang tải ảnh lên"]);
    const nut = screen.getByRole("button", { name: "Thêm ảnh" });
    expect(nut.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(nut);
    expect(moChonTep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hủy tải ảnh" }));
    traLoi({ id: ID, w: 800, h: 600 });
    await xong();
    expect(container.querySelector(".tai-anh")).toBeNull();
    expect(khoiCapCao(container)).toEqual(["P"]);
    // Huy khong duoc lam mat chu da go, khong chi la cau truc khoi khong doi.
    expect(container.querySelector(".ProseMirror p")?.textContent).toBe("Sáng");
  });

  it("anh hong, anh goc qua 40 MB, tai len hong roi Thu lai dung lai anh da xu ly", async () => {
    const { createImageBitmap } = giaLapAnh(800, 600);
    const loi = new DOMException("hong", "InvalidStateError");
    createImageBitmap.mockRejectedValueOnce(loi).mockRejectedValueOnce(loi);
    actionUploadMedia.mockRejectedValueOnce(new Error("mat mang")).mockResolvedValueOnce({ id: ID, w: 800, h: 600 });
    const { container } = await veEditor();

    await chonTep(container, tepTu(jpegDau(800, 600), "hong.jpg", "image/jpeg"));
    expect(dongTai(container)).toEqual(["Ảnh này bị hỏng hoặc không mở được, thử ảnh khác."]);
    expect(vungDoc(container)).toBe("Ảnh này bị hỏng hoặc không mở được, thử ảnh khác.");
    expect(screen.getByRole("button", { name: "Chọn ảnh khác" })).toBeTruthy();

    const lon = tepTu(jpegDau(800, 600), "lon.jpg", "image/jpeg", IMAGE_SOURCE_MAX_BYTES + 1);
    createImageBitmap.mockClear();
    await chonTep(container, lon);
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(dongTai(container)).toEqual(["Ảnh lớn quá (tối đa 40 MB), chọn ảnh khác."]);

    await chonTep(container, tepTu(jpegDau(800, 600), "b.jpg", "image/jpeg"));
    expect([dongTai(container), vungDoc(container)]).toEqual([["Chưa tải được, thử lại."], "Chưa tải được, thử lại."]);
    createImageBitmap.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await xong();
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(actionUploadMedia).toHaveBeenCalledTimes(2);
    expect(khoiCapCao(container)).toEqual(["P", "anh", "P"]);
  });
});

describe("ghi am", () => {
  it("xin micro, ghi va dem gio, dung thi nghe thu; tai hong thi bao, Chen lai gui ms va song am roi chen khoi", async () => {
    const { track, getUserMedia } = giaLapMicro();
    actionUploadMedia.mockRejectedValueOnce(new Error("mat mang")).mockResolvedValueOnce({ id: ID, ms: 42_000, peaks: SONG_MAY_CHU });
    const { container } = await veEditor();
    await moGhiAm();

    const hop = screen.getByRole("region", { name: "Ghi âm" });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    expect(MediaRecorderGia.tao.map((r) => r.mimeType)).toEqual(["audio/webm;codecs=opus"]);
    expect(screen.getByRole("button", { name: "Ghi âm" }).getAttribute("aria-controls")).toBe(hop.id);
    expect(document.activeElement).toBe(within(hop).getByRole("button", { name: "Dừng" }));

    act(() => {
      vi.advanceTimersByTime(42_000);
    });
    expect(within(hop).getByRole("timer").getAttribute("aria-label")).toBe("Đã ghi 0:42, tối đa 3:00");
    expect(hop.querySelector(".ghi-am-hop__trang-thai")?.textContent).toBe("Đang ghi");
    expect(hop.querySelectorAll(".muc-am rect")).toHaveLength(32);

    fireEvent.click(within(hop).getByRole("button", { name: "Dừng" }));
    await xong();
    const nghe = screen.getByRole("region", { name: "Nghe thử" });
    expect(track.stop).toHaveBeenCalled();
    expect(nghe.querySelector(".ghi-am-hop__trang-thai")?.textContent).toBe("Dài 0:42");
    expect(within(nghe).getByRole("figure", { name: "Mạnh ghi âm, dài 0:42" })).toBeTruthy();
    expect(document.activeElement).toBe(within(nghe).getByRole("button", { name: "Phát ghi âm" }));

    fireEvent.click(within(nghe).getByRole("button", { name: "Chèn" }));
    await xong();
    expect(within(nghe).getByRole("alert").lastChild?.textContent).toBe("Chưa tải được, thử lại.");

    fireEvent.click(within(nghe).getByRole("button", { name: "Chèn" }));
    await xong();
    const fd = actionUploadMedia.mock.calls[1][0] as FormData;
    expect([fd.get("kind"), fd.get("book"), fd.get("ms"), (fd.get("file") as File).type]).toEqual(["ghi-am", SACH, "42000", "audio/webm;codecs=opus"]);
    expect(JSON.parse(String(fd.get("peaks")))).toEqual(Array(PEAK_COUNT).fill(100));
    expect(screen.queryByRole("region", { name: "Nghe thử" })).toBeNull();
    expect(khoiCapCao(container)).toEqual(["P", "ghi-am", "P"]);
    expect(vungDoc(container)).toBe("Đã chèn ghi âm.");
    expect(screen.getByRole("button", { name: "Ghi âm" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("tu 2:50 bao con 10 giay, toi 3:00 tu dung va sang nghe thu voi cau nhac tran", async () => {
    const { track } = giaLapMicro();
    await veEditor();
    await moGhiAm();
    act(() => {
      vi.setSystemTime(Date.now() + 170_000);
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("region", { name: "Ghi âm" }).querySelector(".ghi-am-hop__trang-thai")?.textContent).toBe("Còn 10 giây");
    act(() => {
      vi.setSystemTime(Date.now() + 10_000);
      vi.advanceTimersByTime(100);
    });
    await xong();
    const nghe = screen.getByRole("region", { name: "Nghe thử" });
    expect(nghe.querySelector(".ghi-am-hop__trang-thai--dam")?.textContent).toBe("Đã tự dừng ở 3:00");
    expect(within(nghe).getByText("Mỗi đoạn ghi âm dài tối đa 3 phút.")).toBeTruthy();
    expect(within(nghe).getByRole("figure", { name: "Mạnh ghi âm, dài 3:00" })).toBeTruthy();
    // Tu dung cung phai tat micro nhu dung tay: khong de den luc dong hop moi giai phong.
    expect(track.stop).toHaveBeenCalled();
  });

  it("huy duoi 5 giay thi bo luon; tu 5 giay thi hoi Bo doan nay hay Ghi tiep ngay trong hop, Esc bang Huy", async () => {
    const { track } = giaLapMicro();
    const { container } = await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    // Dong ho ghi (setInterval RECORDING_TICK_MS) phai het ngay khi huy, khong duoc chay ngam.
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    fireEvent.click(within(screen.getByRole("region", { name: "Ghi âm" })).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("region", { name: "Ghi âm" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ghi âm" }));
    expect(track.stop).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    // Huy khong duoc lam mat chu da go, khong chi la cau truc khoi khong doi.
    expect(khoiCapCao(container)).toEqual(["P"]);
    expect(container.querySelector(".ProseMirror p")?.textContent).toBe("Sáng");

    await moGhiAm();
    const hop = screen.getByRole("region", { name: "Ghi âm" });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    fireEvent.click(within(hop).getByRole("button", { name: "Hủy" }));
    expect(within(hop).queryByRole("button", { name: "Dừng" })).toBeNull();
    expect(document.activeElement).toBe(within(hop).getByRole("button", { name: "Ghi tiếp" }));
    fireEvent.click(within(hop).getByRole("button", { name: "Ghi tiếp" }));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(within(hop).getByRole("timer").getAttribute("aria-label")).toBe("Đã ghi 0:06, tối đa 3:00");

    fireEvent.keyDown(hop, { key: "Escape" });
    fireEvent.click(within(hop).getByRole("button", { name: "Bỏ đoạn này" }));
    expect(screen.queryByRole("region", { name: "Ghi âm" })).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(actionUploadMedia).not.toHaveBeenCalled();
    expect(khoiCapCao(container)).toEqual(["P"]);
    expect(container.querySelector(".ProseMirror p")?.textContent).toBe("Sáng");
  });

  it("roi trang luc dang ghi cung tat micro va het dong ho ngay, khong doi den luc dong hop", async () => {
    const { track } = giaLapMicro();
    const { unmount } = await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    unmount();
    expect(track.stop).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  /*
   * Cac test tren deu goi ket()/cancel() luc recorder van con "recording" (MediaRecorderGia.stop() dong bo
   * nen khong bao gio bat duoc trang thai "da inactive ma chua qua ket"). Hai test sau day dung tuNgung() de dua recorder
   * ve "inactive" MA KHONG qua stop()/onstop, mo phong dung cai cua so ho: thiet bi mat giua chung,
   * dac ta dat state ve inactive ngay trong thuat toan dung nhung su kien stop la mot task duoc xep hang, con Huy hay roi
   * trang co the den truoc khi task do chay. Day la nhanh duy nhat con lai nhay vao "else don()" cua ket() ma khong di qua
   * onstop; neu dong "if (recorder.state === "inactive") return;" cu quay lai o dau ket(), hai test nay phai do.
   */
  it("recorder tu chuyen inactive ma chua kip bao stop (mat micro giua chung): Huy van phai het dong ho va tat track", async () => {
    const { track } = giaLapMicro();
    await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    MediaRecorderGia.tao.at(-1)?.tuNgung();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    fireEvent.click(within(screen.getByRole("region", { name: "Ghi âm" })).getByRole("button", { name: "Hủy" }));
    expect(clearSpy).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("recorder tu chuyen inactive ma chua kip bao stop: roi trang cung phai het dong ho va tat track", async () => {
    const { track } = giaLapMicro();
    const { unmount } = await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    MediaRecorderGia.tao.at(-1)?.tuNgung();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  /*
   * Truoc khi sua, onstop chi goi onDone khi co flag giu, ma giu chi bat khi
   * chinh ta goi ket(). Trinh duyet tu dung recorder (rut micro, mat quyen giua chung, cuoc goi den) thi onstop chay
   * voi giu === false: hop dung yen mai o "dang ghi", cham nhap nhay, dong ho dong bang, va bam Dung cung khong lam gi
   * va khong noi gi - toi ba phut tieng nguoi mat trong im lang, tren dung man khong co ban nhap de quay lai.
   * Ba test duoi day di ba duong do; ca ba deu do truoc khi sua.
   */
  it("trinh duyet tu dung giua chung (rut micro): doan da ghi hien ra de nghe thu, chen duoc voi dung thoi luong", async () => {
    const { track } = giaLapMicro();
    actionUploadMedia.mockResolvedValue({ id: ID, ms: 42_000, peaks: SONG_MAY_CHU });
    const { container } = await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(42_000);
    });
    await act(async () => {
      MediaRecorderGia.tao.at(-1)?.trinhDuyetDung();
    });
    await xong();

    const nghe = screen.getByRole("region", { name: "Nghe thử" });
    expect(nghe.querySelector(".ghi-am-hop__trang-thai")?.textContent).toBe("Micro dừng ở 0:42");
    expect(within(nghe).getByRole("figure", { name: "Mạnh ghi âm, dài 0:42" })).toBeTruthy();
    expect(within(nghe).getByText("Micro dừng giữa chừng. Nghe thử đoạn đã ghi rồi chèn nếu dùng được.")).toBeTruthy();
    expect(track.stop).toHaveBeenCalled();

    fireEvent.click(within(nghe).getByRole("button", { name: "Chèn" }));
    await xong();
    expect(actionUploadMedia.mock.calls[0][0].get("ms")).toBe("42000");
    expect(khoiCapCao(container)).toEqual(["P", "ghi-am", "P"]);
  });

  it("recorder da inactive ma chua bao stop, khong con byte nao: bam Dung phai bao loi chu khong dung yen", async () => {
    const { track } = giaLapMicro();
    await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    MediaRecorderGia.tao.at(-1)?.tuNgung();
    fireEvent.click(within(screen.getByRole("region", { name: "Ghi âm" })).getByRole("button", { name: "Dừng" }));
    await xong();

    const hop = screen.getByRole("region", { name: "Ghi âm" });
    expect(within(hop).getByRole("alert").lastChild?.textContent).toBe("Micro dừng giữa chừng nên chưa ghi được gì.");
    expect(within(hop).getAllByRole("button").map((b) => b.textContent)).toEqual(["Thử lại", "Đóng"]);
    expect(track.stop).toHaveBeenCalled();
  });

  it("recorder ban su kien error: doan da ghi van den duoc nguoi dung, micro tat ngay", async () => {
    const { track } = giaLapMicro();
    await veEditor();
    await moGhiAm();
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    await act(async () => {
      MediaRecorderGia.tao.at(-1)?.banLoi();
    });
    await xong();

    const nghe = screen.getByRole("region", { name: "Nghe thử" });
    expect(nghe.querySelector(".ghi-am-hop__trang-thai")?.textContent).toBe("Micro dừng ở 0:07");
    expect(track.stop).toHaveBeenCalled();
  });

  it("dung ngay lap tuc van tinh do dai it nhat 1 giay; huy hoac roi trang luc dang nghe thu deu thu URL xem truoc", async () => {
    giaLapMicro();
    const { unmount } = await veEditor();
    await moGhiAm();

    fireEvent.click(within(screen.getByRole("region", { name: "Ghi âm" })).getByRole("button", { name: "Dừng" }));
    await xong();
    const ngheDau = screen.getByRole("region", { name: "Nghe thử" });
    expect(within(ngheDau).getByRole("figure", { name: "Mạnh ghi âm, dài 0:01" })).toBeTruthy();

    fireEvent.click(within(ngheDau).getByRole("button", { name: "Hủy" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:gia");
    expect(screen.queryByRole("region", { name: "Nghe thử" })).toBeNull();

    await moGhiAm();
    fireEvent.click(within(screen.getByRole("region", { name: "Ghi âm" })).getByRole("button", { name: "Dừng" }));
    await xong();
    (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:gia");
  });

  it("MediaRecorder khoi tao hong thi tat micro ngay va bao Khong tim thay micro", async () => {
    const { track } = giaLapMicro();
    class MediaRecorderHong {
      static isTypeSupported = vi.fn(() => true);

      constructor() {
        throw new DOMException("khong khoi tao duoc", "NotSupportedError");
      }
    }
    vi.stubGlobal("MediaRecorder", MediaRecorderHong);
    await veEditor();
    await moGhiAm();
    const hop = screen.getByRole("region", { name: "Ghi âm" });
    expect(within(hop).getByRole("alert").lastChild?.textContent).toBe("Không tìm thấy micro.");
    expect(track.stop).toHaveBeenCalled();
  });

  it("loi micro tach hai cau: chua cho phep co dong huong dan, khong tim thay thi khong; trinh duyet khong ghi duoc cung la khong tim thay", async () => {
    const { getUserMedia } = giaLapMicro();
    getUserMedia.mockRejectedValueOnce(new DOMException("chan", "NotAllowedError")).mockRejectedValueOnce(new DOMException("khong co", "NotFoundError"));
    await veEditor();
    await moGhiAm();
    const hop = screen.getByRole("region", { name: "Ghi âm" });
    expect(within(hop).getByRole("alert").lastChild?.textContent).toBe("Chưa cho phép dùng micro.");
    expect(within(hop).getByText("Cho phép micro cho trang này trong cài đặt trình duyệt rồi thử lại.")).toBeTruthy();

    fireEvent.click(within(hop).getByRole("button", { name: "Thử lại" }));
    await xong();
    expect(within(hop).getByRole("alert").lastChild?.textContent).toBe("Không tìm thấy micro.");
    expect(within(hop).queryByText("Cho phép micro cho trang này trong cài đặt trình duyệt rồi thử lại.")).toBeNull();

    MediaRecorderGia.isTypeSupported.mockReturnValue(false);
    getUserMedia.mockClear();
    fireEvent.click(within(hop).getByRole("button", { name: "Thử lại" }));
    await xong();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(within(hop).getByRole("alert").lastChild?.textContent).toBe("Không tìm thấy micro.");

    fireEvent.click(within(hop).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("region", { name: "Ghi âm" })).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { BookForm, type BookFormProps } from "@/components/book/BookForm";
import { CoverPicker } from "@/components/book/CoverPicker";
import type { CoverKey } from "@/lib/book";
import { IMAGE_SOURCE_MAX_BYTES } from "@/lib/media/image";
import { MEDIA_MAX_BYTES } from "@/lib/media/kinds";
import { isoDau, ispe, jpegDau, KHONG_NHAN, tepTu } from "../helpers/anh-mau";

/*
 * O bia "Anh cua ban" cua form sach tren DOM that: chon tep, buoc cat 5:3 (phim, keo, thu phong),
 * cat bang canvas roi tai len qua actionUploadMedia, bia du phong la tranh ve, kho tat. Canvas,
 * createImageBitmap va blob URL la gia: jsdom khong giai ma hay ve anh.
 */

type KetQuaTai = { error: string } | { id: string; w: number; h: number };

const { actionCreateBook, actionUpdateBook, actionUploadMedia, loadHeif, decodeHeif } = vi.hoisted(() => ({
  actionCreateBook: vi.fn(async (_fd: FormData) => ({ error: "Chưa tạo được." })),
  actionUpdateBook: vi.fn(async (_bookId: string, _fd: FormData) => ({ error: "Chưa lưu được." })),
  actionUploadMedia: vi.fn(async (_fd: FormData): Promise<KetQuaTai> => ({ error: "chua dat" })),
  loadHeif: vi.fn(),
  decodeHeif: vi.fn(),
}));
vi.mock("@/app/actions/library", () => ({ actionCreateBook, actionUpdateBook }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia }));
vi.mock("@/components/media/loadHeif", () => ({ loadHeif }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const BIA = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";

/** Anh nguon 2000x1500 da xoay theo EXIF. */
const bitmap = { width: 2000, height: 1500, close: vi.fn() };
const giaiMa = vi.fn(async (_file: Blob, _options?: ImageBitmapOptions): Promise<typeof bitmap> => bitmap);
/** Anh HEIC 80x120 da xoay tra ve tu bo doc HEIF gia lap. */
const anhHeif = { width: 80, height: 120, close: vi.fn() };
/** Moi lan drawImage: toa do nguon va dich, kem kich thuoc canvas. */
let ve: number[][] = [];
let khongWebp = false;
let byteBlob = 2048;
let soUrl = 0;
/** Kieu va chat luong moi lan toBlob duoc goi, theo thu tu. */
let maHoa: [string | undefined, number | undefined][] = [];

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { value: vi.fn(), configurable: true });
});

beforeEach(() => {
  ve = [];
  khongWebp = false;
  byteBlob = 2048;
  soUrl = 0;
  maHoa = [];
  bitmap.close.mockClear();
  giaiMa.mockClear();
  loadHeif.mockReset();
  loadHeif.mockResolvedValue(decodeHeif);
  decodeHeif.mockReset();
  decodeHeif.mockResolvedValue(anhHeif);
  anhHeif.close.mockClear();
  vi.stubGlobal("createImageBitmap", giaiMa);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return {
      imageSmoothingQuality: "low",
      drawImage: (_nguon: unknown, ...so: number[]) => ve.push([...so, this.width, this.height]),
    } as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback, type?: string, quality?: number) => {
    maHoa.push([type, quality]);
    // Safari cu tra PNG khi khong ma hoa duoc WebP.
    cb(new Blob([new Uint8Array(byteBlob)], { type: type === "image/webp" && khongWebp ? "image/png" : type }));
  });
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:xem-${++soUrl}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  actionUploadMedia.mockImplementation(async () => ({ id: BIA, w: 1200, h: 720 }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const f of [actionCreateBook, actionUpdateBook, actionUploadMedia]) f.mockClear();
});

function formMoi(props: Partial<BookFormProps> = {}) {
  render(<BookForm book={null} nickname="Linh" partnerNickname="Manh" mediaEnabled photos={[]} {...props} />);
  fireEvent.change(screen.getByLabelText("Tên sách"), { target: { value: "Chuyện chưa kể" } });
}

const oTep = () => screen.getByLabelText("Thêm ảnh của bạn làm bìa") as HTMLInputElement;
const oTen = () => screen.getByLabelText("Tên sách") as HTMLInputElement;
const oAnh = () => screen.getByRole("radio", { name: "Ảnh của bạn, vừa tải lên" }) as HTMLInputElement;
const tranh = (ten: string) => screen.getByRole("radio", { name: ten }) as HTMLInputElement;
const nut = (ten: string) => screen.getByRole("button", { name: ten }) as HTMLButtonElement;
/** Moi radio cua bang bia. */
const COVER_RADIOS = () => [...document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="cover"]')];
const xemTruoc = () => screen.getByRole("complementary", { name: "Xem trước trên kệ" });
const loa = () => screen.getByRole("status").textContent;
const san = () => screen.getByRole("group", { name: "Khung cắt ảnh bìa" });
/** x, y, rong, cao cua khung cat, diem anh nguon. */
const soKhung = () => ["x", "y", "width", "height"].map((a) => Number(document.querySelector(".cat-bia__vien")?.getAttribute(a)));

function tepAnh(bytes = 3_000_000): File {
  return tepTu(jpegDau(2000, 1500), "IMG_2041.jpg", "image/jpeg", bytes);
}

async function chon(input: HTMLInputElement, tep = tepAnh()) {
  fireEvent.change(input, { target: { files: [tep] } });
  return screen.findByRole("group", { name: "Khung cắt ảnh bìa" });
}

/** Mot lan tai len chua tra ve, test tu ket thuc. */
function taiTreo() {
  let xong!: (ket: KetQuaTai) => void;
  actionUploadMedia.mockImplementationOnce(() => new Promise<KetQuaTai>((r) => { xong = r; }));
  return (ket: KetQuaTai) => act(async () => xong(ket));
}

describe("BookForm bia tu tai len: buoc cat", () => {
  it("chon anh: giai ma xoay theo EXIF, mo buoc cat duoi bang bia, focus vao san, khung 5:3 lon nhat o giua", async () => {
    formMoi();
    const tep = tepAnh();
    const cat = await chon(oTep(), tep);
    expect(giaiMa).toHaveBeenCalledWith(tep, { imageOrientation: "from-image" });
    expect(document.activeElement).toBe(cat);
    expect(cat.closest("fieldset")?.querySelector("legend")?.textContent).toBe("Bìa");
    expect(screen.getByRole("heading", { name: "Cắt ảnh bìa" })).toBeTruthy();
    expect(cat.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 2000 1500");
    expect(cat.querySelector("image")?.getAttribute("href")).toBe("blob:xem-1");
    expect(ve).toEqual([[0, 0, 1600, 1200, 1600, 1200]]);
    expect(soKhung()).toEqual([0, 150, 2000, 1200]);
    const zoom = screen.getByLabelText("Thu phóng");
    expect(["min", "max", "step", "value"].map((a) => zoom.getAttribute(a))).toEqual(["100", "250", "5", "100"]);
    expect(nut("Tạo sách").disabled).toBe(true);
    expect(actionUploadMedia).not.toHaveBeenCalled();
  });

  it("dang giai ma va ve lai anh xem truoc da khoa nut gui, truoc khi buoc cat kip hien", async () => {
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepAnh()] } });
    expect(nut("Tạo sách").disabled).toBe(true);
    expect(screen.queryByRole("group", { name: "Khung cắt ảnh bìa" })).toBeNull();
    await screen.findByRole("group", { name: "Khung cắt ảnh bìa" });
  });

  it("mui ten doi khung, Shift doi xa hon, phim khac khong bi chan; thu phong thu khung quanh tam", async () => {
    formMoi();
    const cat = await chon(oTep());
    expect(fireEvent.keyDown(cat, { key: "ArrowDown" })).toBe(false);
    expect(soKhung()).toEqual([0, 190, 2000, 1200]);
    fireEvent.keyDown(cat, { key: "ArrowUp", shiftKey: true });
    expect(soKhung()).toEqual([0, 0, 2000, 1200]);
    fireEvent.change(screen.getByLabelText("Thu phóng"), { target: { value: "200" } });
    expect(soKhung()).toEqual([500, 300, 1000, 600]);
    fireEvent.keyDown(cat, { key: "ArrowRight", shiftKey: true });
    expect(soKhung()).toEqual([700, 300, 1000, 600]);
    expect(fireEvent.keyDown(cat, { key: "Enter" })).toBe(true);
    expect(soKhung()).toEqual([700, 300, 1000, 600]);
  });

  it("keo bang con tro: khung doi theo ti le hien cua san, chi theo con tro dang keo", async () => {
    formMoi();
    const cat = await chon(oTep());
    fireEvent.change(screen.getByLabelText("Thu phóng"), { target: { value: "200" } });
    vi.spyOn(cat, "getBoundingClientRect").mockReturnValue({ width: 500, height: 375 } as DOMRect);
    fireEvent.pointerDown(cat, { pointerId: 3, button: 0, clientX: 100, clientY: 100 });
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(3);
    fireEvent.pointerMove(cat, { pointerId: 3, clientX: 150, clientY: 75 });
    expect(soKhung()).toEqual([700, 350, 1000, 600]);
    fireEvent.pointerMove(cat, { pointerId: 9, clientX: 400, clientY: 400 });
    fireEvent.pointerUp(cat, { pointerId: 3 });
    fireEvent.pointerMove(cat, { pointerId: 3, clientX: 0, clientY: 0 });
    expect(soKhung()).toEqual([700, 350, 1000, 600]);
  });

  it("Huy dong buoc cat, giai phong anh, khong tai gi, focus ve o chon tep", async () => {
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Hủy"));
    expect(screen.queryByRole("group", { name: "Khung cắt ảnh bìa" })).toBeNull();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:xem-1");
    expect(document.activeElement).toBe(oTep());
    expect(nut("Tạo sách").disabled).toBe(false);
    expect(actionUploadMedia).not.toHaveBeenCalled();
  });

  it("Chon anh khac trong buoc cat mo lai chon tep; anh moi thay anh cu va giai phong anh cu", async () => {
    formMoi();
    await chon(oTep());
    const bam = vi.spyOn(oTep(), "click");
    fireEvent.click(nut("Chọn ảnh khác"));
    expect(bam).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.change(oTep(), { target: { files: [tepAnh()] } });
    });
    await waitFor(() => expect(san().querySelector("image")?.getAttribute("href")).toBe("blob:xem-2"));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:xem-1");
  });
});

describe("BookForm bia tu tai len: tai len", () => {
  it("o chon tep nhan ca HEIC, HEIF, AVIF", () => {
    formMoi();
    expect(oTep().accept).toBe("image/*,.heic,.heif,.avif");
  });

  it("HEIC: luc bo doc HEIF dang chay hien Dang doc anh, nut gui khoa; Huy doc thi bo ket qua va tra anh", async () => {
    const loi = new DOMException("heic", "InvalidStateError");
    giaiMa.mockRejectedValueOnce(loi).mockRejectedValueOnce(loi);
    let xong!: (b: typeof anhHeif) => void;
    decodeHeif.mockImplementationOnce(() => new Promise((ok) => { xong = ok; }));
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepTu(isoDau("heic", ["mif1"], ispe(120, 80)), "IMG_0003.HEIC")] } });
    expect(await screen.findByRole("progressbar", { name: "Đang đọc ảnh" })).toBeTruthy();
    expect(loa()).toBe("Đang đọc ảnh");
    expect(nut("Tạo sách").disabled).toBe(true);
    fireEvent.click(nut("Hủy đọc ảnh"));
    expect([screen.queryByRole("progressbar"), nut("Tạo sách").disabled, document.activeElement === oTep()]).toEqual([null, false, true]);
    await act(async () => xong(anhHeif));
    expect(screen.queryByRole("group", { name: "Khung cắt ảnh bìa" })).toBeNull();
    expect(anhHeif.close).toHaveBeenCalledTimes(1);
  });

  it("khong nap duoc bo doc HEIF: Thu lai nap lai va doc lai dung tep, mo buoc cat", async () => {
    const loi = new DOMException("heic", "InvalidStateError");
    giaiMa.mockRejectedValueOnce(loi).mockRejectedValueOnce(loi).mockRejectedValueOnce(loi).mockRejectedValueOnce(loi);
    loadHeif.mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"));
    formMoi();
    const tep = tepTu(isoDau("heic", ["mif1"], ispe(120, 80)), "IMG_0004.HEIC");
    fireEvent.change(oTep(), { target: { files: [tep] } });
    await waitFor(() => expect(loa()).toBe("Chưa tải được bộ đọc ảnh iPhone, thử lại."));
    expect(screen.queryByRole("button", { name: "Chọn ảnh khác" })).toBeNull();
    fireEvent.click(nut("Thử lại"));
    const cat = await screen.findByRole("group", { name: "Khung cắt ảnh bìa" });
    expect(cat.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 80 120");
    expect(loadHeif).toHaveBeenCalledTimes(2);
    expect(decodeHeif).toHaveBeenCalledWith(tep);
  });

  it("Dung anh nay: cat dung khung ve 1200x720 WebP, tai len loai bia; xong thi Anh cua ban dang chon, xem truoc doi theo, form gui coverMedia", async () => {
    const xong = taiTreo();
    formMoi();
    const cat = await chon(oTep());
    fireEvent.keyDown(cat, { key: "ArrowDown" });
    fireEvent.click(nut("Dùng ảnh này"));
    expect(await screen.findByRole("progressbar", { name: "Đang tải ảnh bìa lên" })).toBeTruthy();
    expect(loa()).toBe("Đang tải ảnh bìa lên");
    expect(ve.at(-1)).toEqual([0, 190, 2000, 1200, 0, 0, 1200, 720, 1200, 720]);
    const fd = actionUploadMedia.mock.calls[0][0];
    const tep = fd.get("file") as File;
    expect([fd.get("kind"), fd.get("book"), tep.type, tep.size]).toEqual(["bia", "", "image/webp", 2048]);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:xem-1");
    expect(screen.queryByRole("group", { name: "Khung cắt ảnh bìa" })).toBeNull();
    expect(nut("Tạo sách").disabled).toBe(true);

    await xong({ id: BIA, w: 1200, h: 720 });
    expect([oAnh().checked, document.activeElement === oAnh()]).toEqual([true, true]);
    expect(COVER_RADIOS().filter((r) => r.checked)).toEqual([oAnh()]);
    // O chon tep VAN o day: tai anh len la khong gioi han, anh vua tai chi them mot o chu khong the cho o chon tep.
    expect(oTep()).toBeTruthy();
    expect(oAnh().closest(".swatch")?.querySelector("img.bia__anh")?.getAttribute("src")).toBe(`/m/${BIA}`);
    expect(xemTruoc().querySelector(".book__cover.bia--nui-xa img.bia__anh")?.getAttribute("src")).toBe(`/m/${BIA}`);
    expect(screen.getByText("Ảnh chưa tải được thì bìa hiện tranh Núi xa.")).toBeTruthy();
    expect([screen.queryByRole("progressbar"), loa()]).toEqual([null, ""]);

    fireEvent.click(nut("Tạo sách"));
    await waitFor(() => expect(actionCreateBook).toHaveBeenCalledTimes(1));
    const gui = actionCreateBook.mock.calls[0][0];
    expect([gui.getAll("cover"), gui.get("coverMedia")]).toEqual([["nui-xa"], BIA]);
  });

  it("tai xong: o chon tep van la chinh no, o anh la mot o moi, khong canh bao doi o khong kiem soat thanh co kiem soat", async () => {
    const than = vi.spyOn(console, "error").mockImplementation(() => {});
    const xong = taiTreo();
    formMoi();
    // O chon tep (type=file, khong kiem soat) va o anh (type=radio, co kiem soat) la hai o RIENG o hai vi tri rieng,
    // nen React khong bao gio phai bien o nay thanh o kia. Bai giu dung dieu do: sau khi tai xong, o chon tep van la
    // dung nut DOM cu, o anh la mot nut khac, va khong co canh bao "controlled" nao.
    const tepCu = oTep();
    await chon(tepCu);
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(actionUploadMedia).toHaveBeenCalledTimes(1));
    await xong({ id: BIA, w: 1200, h: 720 });

    expect(oTep()).toBe(tepCu);
    expect(oAnh()).not.toBe(tepCu);
    const than2 = than.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("controlled"));
    than.mockRestore();
    expect(than2).toEqual([]);
  });

  it("trinh duyet khong ma hoa duoc WebP (tra PNG): gui JPEG", async () => {
    khongWebp = true;
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(actionUploadMedia).toHaveBeenCalledTimes(1));
    expect((actionUploadMedia.mock.calls[0][0].get("file") as File).type).toBe("image/jpeg");
  });

  it("anh da cat van qua tran may chu: bao Anh lon qua, khong tai len; Chon anh khac mo lai chon tep, Dong an dong loi", async () => {
    byteBlob = MEDIA_MAX_BYTES.bia + 1;
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(loa()).toBe("Ảnh lớn quá, chọn ảnh khác."));
    expect(document.querySelector(".tai-anh__chu--loi")?.textContent).toBe("!Ảnh lớn quá, chọn ảnh khác.");
    expect(maHoa.slice(-3)).toEqual([["image/webp", 0.82], ["image/webp", 0.72], ["image/webp", 0.6]]);
    expect(actionUploadMedia).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    const bam = vi.spyOn(oTep(), "click");
    fireEvent.click(nut("Chọn ảnh khác"));
    expect(bam).toHaveBeenCalledTimes(1);
    fireEvent.click(nut("Đóng"));
    expect([document.querySelector(".tai-anh"), loa()]).toEqual([null, ""]);
  });

  it("tep goc qua 40 MB: bao Anh lon qua (toi da 40 MB) ma khong giai ma; dung tran thi van mo buoc cat", async () => {
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepAnh(IMAGE_SOURCE_MAX_BYTES + 1)] } });
    await waitFor(() => expect(loa()).toBe("Ảnh lớn quá (tối đa 40 MB), chọn ảnh khác."));
    expect(giaiMa).not.toHaveBeenCalled();
    await chon(oTep(), tepAnh(IMAGE_SOURCE_MAX_BYTES));
    expect(document.querySelector(".tai-anh")).toBeNull();
  });

  it("trinh duyet khong giai ma duoc: bao anh hong, khong co dong goi y", async () => {
    const loi = new DOMException("Khong giai ma duoc", "InvalidStateError");
    giaiMa.mockRejectedValueOnce(loi).mockRejectedValueOnce(loi);
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepAnh()] } });
    await waitFor(() => expect(loa()).toBe("Ảnh này bị hỏng hoặc không mở được, thử ảnh khác."));
    expect(document.querySelector(".tai-anh__phu")).toBeNull();
    expect(screen.queryByRole("group", { name: "Khung cắt ảnh bìa" })).toBeNull();
    expect(nut("Tạo sách").disabled).toBe(false);
    expect(giaiMa).toHaveBeenCalledTimes(2);
    expect(loadHeif).not.toHaveBeenCalled();
  });

  it("readSourceImage nem loi giua chung (khong tra chuoi, vd nguon anh bi dong o noi khac luc ve xem truoc): thoat trang thai ban, hien dung cau anh hong, cho chon lai", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return {
        imageSmoothingQuality: "low",
        drawImage: () => {
          throw new Error("mat nguon anh giua chung");
        },
      } as never;
    });
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepAnh()] } });
    await waitFor(() => expect(loa()).toBe("Ảnh này bị hỏng hoặc không mở được, thử ảnh khác."));
    expect(screen.queryByRole("group", { name: "Khung cắt ảnh bìa" })).toBeNull();
    expect(nut("Tạo sách").disabled).toBe(false);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("anh 48 MP: thu nho ngay luc giai ma, khong giai ma nguyen co", async () => {
    formMoi();
    const tep = tepTu(jpegDau(8000, 6000), "IMG_48MP.jpg", "image/jpeg", 18_000_000);
    await chon(oTep(), tep);
    expect(giaiMa).toHaveBeenCalledWith(tep, { imageOrientation: "from-image", resizeWidth: 4729, resizeQuality: "high" });
  });

  it("loai khong nhan (TIFF): cau loi kem dong goi y, vung doc doc ca hai, khong giai ma", async () => {
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepTu(KHONG_NHAN["TIFF II"], "scan.tif", "image/tiff")] } });
    await waitFor(() => expect(loa()).toBe("Chưa đọc được loại ảnh này. Hãy chọn ảnh JPG, PNG, HEIC hoặc WebP."));
    expect(document.querySelector(".tai-anh__chu--loi")?.textContent).toBe("!Chưa đọc được loại ảnh này.");
    expect(document.querySelector(".tai-anh__phu")?.textContent).toBe("Hãy chọn ảnh JPG, PNG, HEIC hoặc WebP.");
    expect(giaiMa).not.toHaveBeenCalled();
  });

  it("HEIC ma trinh duyet khong doc duoc: nap bo doc HEIF, mo buoc cat voi anh da xoay", async () => {
    const loi = new DOMException("heic", "InvalidStateError");
    giaiMa.mockRejectedValueOnce(loi).mockRejectedValueOnce(loi);
    formMoi();
    const tep = tepTu(isoDau("heic", ["mif1", "heic"], ispe(120, 80)), "IMG_0001.HEIC");
    const cat = await chon(oTep(), tep);
    expect(decodeHeif).toHaveBeenCalledWith(tep);
    expect(cat.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 80 120");
  });

  it("khong nap duoc bo doc HEIF (mat mang): bao cau rieng cua bo doc anh iPhone", async () => {
    const loi = new DOMException("heic", "InvalidStateError");
    giaiMa.mockRejectedValueOnce(loi).mockRejectedValueOnce(loi);
    loadHeif.mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"));
    formMoi();
    fireEvent.change(oTep(), { target: { files: [tepTu(isoDau("heic", ["mif1"]), "IMG_0002.HEIC")] } });
    await waitFor(() => expect(loa()).toBe("Chưa tải được bộ đọc ảnh iPhone, thử lại."));
    expect(decodeHeif).not.toHaveBeenCalled();
    expect(nut("Tạo sách").disabled).toBe(false);
  });

  it("mat mang khi tai: bao Chua tai duoc; Thu lai gui lai anh da cat, khong giai ma hay cat lai", async () => {
    actionUploadMedia.mockRejectedValueOnce(new Error("mat mang"));
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(loa()).toBe("Chưa tải được, thử lại."));
    expect(screen.queryByRole("button", { name: "Chọn ảnh khác" })).toBeNull();
    // Bia loi khong dong nghia mat chu nguoi viet da go vao o khac cua form.
    expect(oTen().value).toBe("Chuyện chưa kể");
    fireEvent.click(nut("Thử lại"));
    await waitFor(() => expect(oAnh().checked).toBe(true));
    expect(actionUploadMedia).toHaveBeenCalledTimes(2);
    expect((actionUploadMedia.mock.calls[1][0].get("file") as File).size).toBe(2048);
    expect([giaiMa.mock.calls.length, ve.filter((v) => v.length === 10).length]).toEqual([1, 1]);
  });

  it("may chu tu choi: hien dung cau cua may chu, co Chon anh khac, khong co Thu lai", async () => {
    actionUploadMedia.mockResolvedValueOnce({ error: "Chưa bật kho lưu ảnh và ghi âm." });
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(loa()).toBe("Chưa bật kho lưu ảnh và ghi âm."));
    expect(nut("Chọn ảnh khác")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Ảnh của bạn, vừa tải lên" })).toBeNull();
    // May chu tu choi bia khong lam mat chu nguoi viet da go vao o khac cua form.
    expect(oTen().value).toBe("Chuyện chưa kể");
  });

  it("doi tranh ve trong luc dang tai: tai xong anh la bia, tranh vua doi la du phong", async () => {
    const xong = taiTreo();
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await screen.findByRole("progressbar", { name: "Đang tải ảnh bìa lên" });
    fireEvent.click(tranh("Bìa trăng trên nước"));
    await xong({ id: BIA, w: 1200, h: 720 });
    expect(oAnh().checked).toBe(true);
    expect(screen.getByText("Ảnh chưa tải được thì bìa hiện tranh Trăng trên nước.")).toBeTruthy();
  });

  it("Huy khi dang tai: bo ket qua ve sau, bia giu nhu cu, gui form duoc ngay", async () => {
    const xong = taiTreo();
    formMoi();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await screen.findByRole("progressbar", { name: "Đang tải ảnh bìa lên" });
    fireEvent.click(nut("Hủy tải ảnh bìa"));
    expect([screen.queryByRole("progressbar"), nut("Tạo sách").disabled, document.activeElement === oTep()]).toEqual([null, false, true]);
    await xong({ id: BIA, w: 1200, h: 720 });
    expect(screen.queryByRole("radio", { name: "Ảnh của bạn, vừa tải lên" })).toBeNull();
    expect(tranh("Bìa núi xa").checked).toBe(true);
  });
});

/*
 * Phan quyet B2 cua dot 24.09: "o bia va o nhac ROI KHOI phan tren cua Sua sach, chuyen han xuong hai muc danh sach.
 * Ly do: giu ca hai la hai duong ghi cho cung mot gia tri." Bang bia chi con o form TAO, nen nam bai dung tren form SUA
 * (bia anh dang dung va cach bo no, nut Doi anh gui book la id cuon, kho chua bat ma cuon da co bia anh) khong con man
 * nao de chay. Chung phai duoc dung lai tren hai muc danh sach khi hai muc do ra doi.
 */
describe("BookForm bia tu tai len: kho chua bat", () => {
  it("sach moi khi kho chua bat: chi tranh ve san, gui coverMedia rong", async () => {
    formMoi({ mediaEnabled: false });
    expect(COVER_RADIOS().map((r) => r.value)).toEqual([
      "nui-xa", "khom-truc", "trang-nuoc", "chim-bay", "hoa-dao", "doi-chim", "thuyen-trang", "cau-go", "doi-thong", "meo-mai",
    ]);
    fireEvent.click(nut("Tạo sách"));
    await waitFor(() => expect(actionCreateBook).toHaveBeenCalledTimes(1));
    expect([actionCreateBook.mock.calls[0][0].getAll("cover"), actionCreateBook.mock.calls[0][0].get("coverMedia")]).toEqual([["nui-xa"], ""]);
  });
});

/*
 * Yeu cau so 4 cua chu du an: "Tai anh bia moi len KHONG GIOI HAN. Anh moi KHONG BAO GIO the cho anh cu, du anh cu co
 * dang duoc chon lam bia hay khong." Bang bia vi vay ve CA kho anh cua cuon, moi anh mot o.
 */
describe("bang bia la kho anh cua cuon", () => {
  const A1 = "1111aaaa-1111-4111-8111-111111111111";
  const A2 = "2222bbbb-2222-4222-8222-222222222222";
  const KHO = [{ id: A2, nhan: "Ảnh của bạn, tải 21.09" }, { id: A1, nhan: "Ảnh của bạn, tải 20.09" }];
  /** Id cua lan tai thu hai trong cung mot phien. */
  const BIA2 = "3333cccc-3333-4333-8333-333333333333";

  it("moi anh trong kho la mot o rieng, moi nhat dung truoc, sau muoi tranh ve", () => {
    formMoi({ photos: KHO });
    expect(COVER_RADIOS().map((r) => r.getAttribute("data-anh"))).toEqual([...Array(10).fill(null), A2, A1]);
  });

  it("moi o anh co nhan rieng de trinh doc man hinh phan biet duoc", () => {
    formMoi({ photos: KHO });
    for (const p of KHO) expect(screen.getByRole("radio", { name: p.nhan })).toBeTruthy();
  });

  it("chon mot anh trong kho: truong an mang dung id do, tranh du phong van di kem", async () => {
    formMoi({ photos: KHO });
    fireEvent.click(screen.getByRole("radio", { name: KHO[1].nhan }));
    fireEvent.click(nut("Tạo sách"));
    await waitFor(() => expect(actionCreateBook).toHaveBeenCalledTimes(1));
    const gui = actionCreateBook.mock.calls[0][0];
    expect([gui.getAll("cover"), gui.get("coverMedia")]).toEqual([["nui-xa"], A1]);
  });

  it("chon lai mot tranh ve thi truong an rong lai", async () => {
    formMoi({ photos: KHO });
    fireEvent.click(screen.getByRole("radio", { name: KHO[0].nhan }));
    fireEvent.click(tranh("Bìa cành hoa đào"));
    fireEvent.click(nut("Tạo sách"));
    await waitFor(() => expect(actionCreateBook).toHaveBeenCalledTimes(1));
    const gui = actionCreateBook.mock.calls[0][0];
    expect([gui.getAll("cover"), gui.get("coverMedia")]).toEqual([["hoa-dao"], ""]);
  });

  it("tai anh moi chi THEM mot o, moi o cu con nguyen va van chon lai duoc", async () => {
    const xong = taiTreo();
    formMoi({ photos: KHO });
    const truocKhiTai = COVER_RADIOS().length;
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(actionUploadMedia).toHaveBeenCalledTimes(1));
    await xong({ id: BIA, w: 1200, h: 720 });
    expect(COVER_RADIOS().length).toBe(truocKhiTai + 1);
    expect(COVER_RADIOS().map((r) => r.getAttribute("data-anh"))).toEqual([...Array(10).fill(null), BIA, A2, A1]);

    // Tai them mot anh NUA: anh vua tai o tren cung va anh tai truoc do van con. Khong co buoc nay thi mot ban vá
    // "moi lan tai thay het danh sach" van xanh, vi lan tai dau tien nao cung chi them dung mot o.
    const xong2 = taiTreo();
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(actionUploadMedia).toHaveBeenCalledTimes(2));
    await xong2({ id: BIA2, w: 1200, h: 720 });
    expect(COVER_RADIOS().length).toBe(truocKhiTai + 2);
    expect(COVER_RADIOS().map((r) => r.getAttribute("data-anh"))).toEqual([...Array(10).fill(null), BIA2, BIA, A2, A1]);

    // Anh cu van chon lai duoc: khong o nao bi thay cho.
    fireEvent.click(screen.getByRole("radio", { name: KHO[1].nhan }));
    expect(screen.getByRole("radio", { name: KHO[1].nhan })).toHaveProperty("checked", true);
  });

  it("tai len goi actionUploadMedia voi truong book la id cuon dang sua", async () => {
    render(
      <CoverPicker
        value={{ cover: "nui-xa", photoId: null }}
        onChange={() => {}}
        photos={[]}
        giuDuoc={false}
        bookId="sach-1"
        mediaEnabled
        disabled={false}
        onBusyChange={() => {}}
      />,
    );
    await chon(oTep());
    fireEvent.click(nut("Dùng ảnh này"));
    await waitFor(() => expect(actionUploadMedia).toHaveBeenCalledTimes(1));
    expect(actionUploadMedia.mock.calls[0][0].get("book")).toBe("sach-1");
  });

  it("kho media tat ma cuon da co anh bia: moi anh van hien va van chon duoc, chi mat o chon tep", () => {
    formMoi({ photos: KHO, mediaEnabled: false });
    expect(screen.queryByLabelText("Thêm ảnh của bạn làm bìa")).toBeNull();
    for (const p of KHO) expect(screen.getByRole("radio", { name: p.nhan })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: KHO[0].nhan }));
    expect(screen.getByRole("radio", { name: KHO[0].nhan })).toHaveProperty("checked", true);
  });
});

/*
 * O "Giu bia dang dung" chi co o trang Viet tiep: o do ca hai o deu bo trong duoc, va mot nhom radio khong co o nao
 * duoc chon la trang thai ban phim te ma nguoi dung khong go lua chon ra duoc. Trang Sach moi bat buoc co bia nen
 * khong co o nay.
 */
describe("o Giu bia dang dung", () => {
  function picker(giuDuoc: boolean, value = { cover: null as CoverKey | null, photoId: null as string | null }) {
    const onChange = vi.fn();
    render(
      <CoverPicker
        value={value}
        onChange={onChange}
        photos={[]}
        giuDuoc={giuDuoc}
        bookId="sach-1"
        mediaEnabled
        disabled={false}
        onBusyChange={() => {}}
      />,
    );
    return onChange;
  }

  it("bat thi o dung dau bang va dang duoc chon khi chua chon bia nao", () => {
    picker(true);
    const o = COVER_RADIOS()[0];
    expect([o.value, o.checked]).toEqual(["", true]);
    expect(screen.getByRole("radio", { name: "Giữ bìa đang dùng, lượt này không thêm bìa" })).toBe(o);
  });

  it("tat thi khong co o do", () => {
    picker(false, { cover: "nui-xa", photoId: null });
    expect(screen.queryByRole("radio", { name: "Giữ bìa đang dùng, lượt này không thêm bìa" })).toBeNull();
    expect(COVER_RADIOS()[0].value).toBe("nui-xa");
  });

  it("chon o do thi ca hai truong deu rong", () => {
    const onChange = picker(true, { cover: "hoa-dao", photoId: null });
    fireEvent.click(screen.getByRole("radio", { name: "Giữ bìa đang dùng, lượt này không thêm bìa" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]({ cover: "hoa-dao", photoId: null })).toEqual({ cover: null, photoId: null });
  });

  it("chua chon bia thi truong an coverMedia rong", () => {
    picker(true);
    expect(document.querySelector<HTMLInputElement>('input[name="coverMedia"]')?.value).toBe("");
  });
});

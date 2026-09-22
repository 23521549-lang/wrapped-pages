import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { tranNgang } from "./kho-sach";

/*
 * Buoc e2e dung chung cho media. Anh mau duoc ve ngay trong trinh duyet dang chay test (canvas ra PNG, JPEG) hoac
 * dung tu byte (GIF, TIFF); rieng HEIC va AVIF la tep nho trong tests/e2e/fixtures vi trinh duyet khong ma hoa
 * duoc hai loai nay. E2E luon dung kho tep tren dia cuc bo: khong dat bien MEDIA_S3_*, khong ra mang.
 */

/** Byte cua mot anh w x h kieu type, ve bang canvas cua chinh trang dang mo. */
async function veAnh(page: Page, w: number, h: number, type: "image/png" | "image/jpeg"): Promise<Buffer> {
  const bytes = await page.evaluate(async ([rong, cao, kieu]) => {
    const canvas = document.createElement("canvas");
    canvas.width = rong;
    canvas.height = cao;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("khong cap duoc context 2d");
    ctx.fillStyle = "#cfe3ff";
    ctx.fillRect(0, 0, rong, cao);
    ctx.fillStyle = "#1b3a6b";
    ctx.fillRect(Math.round(rong / 4), Math.round(cao / 4), Math.round(rong / 2), Math.round(cao / 2));
    const blob = await new Promise<Blob | null>((xong) => canvas.toBlob(xong, kieu, 0.9));
    if (!blob) throw new Error("khong ma hoa duoc anh");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, [w, h, type] as const);
  return Buffer.from(bytes);
}

/** Byte cua mot anh PNG w x h, ve bang canvas cua chinh trang dang mo. */
export function anhPng(page: Page, w: number, h: number): Promise<Buffer> {
  return veAnh(page, w, h, "image/png");
}

/**
 * JPEG luu w x h kem khoi APP1 Exif chi co the Orientation, chen ngay sau SOI, nhu anh chup dien thoai cam doc. Chrome
 * doc huong nay khi giai ma voi imageOrientation from-image, nen buoc cat phai thay anh da xoay.
 */
export async function anhJpegXoay(page: Page, w: number, h: number, orientation: number): Promise<Buffer> {
  const jpeg = await veAnh(page, w, h, "image/jpeg");
  const exif = Buffer.from([
    0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8,
    0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0,
  ]);
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

/**
 * GIF mot mau w x h tu dung byte (canvas khong ma hoa duoc GIF): bang mau hai mau, du lieu LZW khong nen voi ma toi
 * thieu 2 bit. Truoc moi diem anh chen ma xoa (4) nen bang ma khong bao gio lon va do rong ma dung yen 3 bit.
 */
export function anhGif(w: number, h: number): Buffer {
  const ma: number[] = [];
  for (let i = 0; i < w * h; i++) ma.push(4, 1);
  ma.push(5);
  const du: number[] = [];
  let bit = 0;
  let so = 0;
  for (const m of ma) {
    bit |= m << so;
    so += 3;
    while (so >= 8) {
      du.push(bit & 255);
      bit >>= 8;
      so -= 8;
    }
  }
  if (so > 0) du.push(bit & 255);
  const khoi: number[] = [];
  for (let i = 0; i < du.length; i += 255) {
    const phan = du.slice(i, i + 255);
    khoi.push(phan.length, ...phan);
  }
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, w >> 8, h & 255, h >> 8, 0x80, 0, 0,
    0xcf, 0xe3, 0xff, 0x1b, 0x3a, 0x6b,
    0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0,
    2, ...khoi, 0, 0x3b,
  ]);
}

/** Dau mot tep TIFF (byte II, 42): loai spec khong nhan. */
export function anhTiff(): Buffer {
  return Buffer.from([0x49, 0x49, 42, 0, 8, 0, 0, 0, ...Array.from({ length: 64 }, () => 0)]);
}

export type TepMau = "plain.heic" | "orient6.heic" | "plain.avif" | "plain.png";

/** Tep mau that trong tests/e2e/fixtures (cach sinh o README.md cua thu muc do). type de trong nhu anh chuyen qua ung dung chat. */
export function tepMau(ten: TepMau): { name: string; mimeType: string; buffer: Buffer } {
  return { name: ten, mimeType: "", buffer: readFileSync(`tests/e2e/fixtures/${ten}`) };
}

/**
 * Chon mot anh w x h qua o chon tep an cua man viet dang mo, doi khoi anh moi hien ra, tra id media cua no.
 * Khoi duoc chen ngay sau khoi dang chua con tro, dung nhu nut Them anh lam.
 */
export async function themAnh(page: Page, w: number, h: number): Promise<string> {
  const anh = page.locator(".viet-chu .node-anh img");
  const truoc = await anh.count();
  await page.locator('input[type="file"]').setInputFiles({ name: "anh.png", mimeType: "image/png", buffer: await anhPng(page, w, h) });
  const moi = anh.nth(truoc);
  await expect(moi).toBeVisible();
  const src = (await moi.getAttribute("src")) ?? "";
  const id = src.replace("/m/", "");
  expect(id, "id media trong src cua khoi anh").toMatch(new RegExp("^[0-9a-f-]{36}$"));
  return id;
}

/** Ma HTTP cua mot lan tai media bang chinh phien cua trang: page.request mang cookie cua context. */
export async function maTaiMedia(page: Page, id: string): Promise<number> {
  const r = await page.request.get(`/m/${id}`);
  return r.status();
}

export type MicHong = "NotAllowedError" | "NotFoundError";

/**
 * Gia micro cho moi lan tai trang sau do. Tieng la mot OscillatorNode noi vao MediaStreamAudioDestinationNode, nen
 * MediaRecorder cua Chromium ghi that ra WebM. Truyen hong de getUserMedia tu choi bang dung ten loi.
 */
export async function giaMicro(page: Page, hong: MicHong | null = null): Promise<void> {
  await page.addInitScript((loi: MicHong | null) => {
    const AudioCtx = window.AudioContext;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (loi) throw new DOMException("micro gia lap", loi);
          const ctx = new AudioCtx();
          await ctx.resume();
          const osc = ctx.createOscillator();
          const dich = ctx.createMediaStreamDestination();
          osc.frequency.value = 220;
          osc.connect(dich);
          osc.start();
          return dich.stream;
        },
      },
    });
  }, hong);
}

/**
 * Chi so to (tu 0) cua phan tu dau tien khop chon trong man viet, doc trong mot lan evaluate de moi so do cung nam
 * trong mot khung hinh. -1 la khong tim thay khoi hay chua co to nao.
 */
export async function toCuaKhoi(page: Page, chon: string): Promise<number> {
  return page.evaluate((sel) => {
    const khoi = document.querySelector(sel);
    const cacTo = Array.from(document.querySelectorAll(".viet-to"));
    if (!khoi || cacTo.length === 0) return -1;
    const dinh = khoi.getBoundingClientRect().top + 1;
    return cacTo.findIndex((t) => {
      const r = t.getBoundingClientRect();
      return dinh >= r.top && dinh < r.bottom;
    });
  }, chon);
}

/** Be rong bat buoc do tran ngang. */
export const BE_RONG = [320, 375, 414, 768] as const;

/** Khong tran ngang o ca bon be rong, roi tra khung nhin ve co cu. */
export async function khongTranNgang(page: Page, ten: string): Promise<void> {
  const cu = page.viewportSize();
  for (const width of BE_RONG) {
    await page.setViewportSize({ width, height: 800 });
    expect(await tranNgang(page), `${ten} tran ngang o ${width}px`).toEqual([]);
  }
  if (cu) await page.setViewportSize(cu);
}

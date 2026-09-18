import { expect, type Page } from "@playwright/test";
import { tranNgang } from "./kho-sach";

/*
 * Buoc e2e dung chung cho media. Anh mau duoc ve ngay trong trinh duyet dang chay test (canvas ra PNG), nen
 * repo khong can tep nhi phan nao. E2E luon dung kho tep tren dia cuc bo: khong dat bien MEDIA_S3_*, khong ra mang.
 */

/** Byte cua mot anh PNG w x h, ve bang canvas cua chinh trang dang mo. */
export async function anhPng(page: Page, w: number, h: number): Promise<Buffer> {
  const bytes = await page.evaluate(async ([rong, cao]) => {
    const canvas = document.createElement("canvas");
    canvas.width = rong;
    canvas.height = cao;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("khong cap duoc context 2d");
    ctx.fillStyle = "#cfe3ff";
    ctx.fillRect(0, 0, rong, cao);
    ctx.fillStyle = "#1b3a6b";
    ctx.fillRect(Math.round(rong / 4), Math.round(cao / 4), Math.round(rong / 2), Math.round(cao / 2));
    const blob = await new Promise<Blob | null>((xong) => canvas.toBlob(xong, "image/png"));
    if (!blob) throw new Error("khong ma hoa duoc PNG");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, [w, h]);
  return Buffer.from(bytes);
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

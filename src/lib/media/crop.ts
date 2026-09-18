import { COVER_RATIO, IMAGE_MAX_WIDTH_PX } from "./kinds";

/** Kich thuoc cua anh nguon da xoay theo EXIF, diem anh. */
export type ImageSize = { width: number; height: number };
/** Trang thai buoc cat bia: goc tren trai cua khung trong anh nguon (diem anh) va muc thu phong (phan tram). */
export type CropState = { x: number; y: number; zoom: number };
/** Khung cat trong anh nguon, diem anh. */
export type CropRect = { x: number; y: number; width: number; height: number };

/** Thanh Thu phong: 100 la khung COVER_RATIO lon nhat nam tron trong anh, 250 la khung nho con 1/2.5 quanh tam. */
export const COVER_ZOOM = { min: 100, max: 250, step: 5 } as const;
/** Mot lan bam mui ten doi khung CROP_STEP canh dai cua anh; giu Shift thi CROP_STEP_FAR. */
export const CROP_STEP = 0.02;
export const CROP_STEP_FAR = 0.1;

/** Huong doi khung cua tung phim mui ten. */
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Muc thu phong trong khoang cua thanh truot; gia tri khong phai so ve muc nho nhat. */
function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? clamp(zoom, COVER_ZOOM.min, COVER_ZOOM.max) : COVER_ZOOM.min;
}

/** Kich thuoc khung o muc thu phong zoom: luon dung COVER_RATIO, 100% la khung lon nhat vua anh. */
function frameSize(size: ImageSize, zoom: number): { width: number; height: number } {
  const full = Math.min(size.width / COVER_RATIO.width, size.height / COVER_RATIO.height);
  const unit = (full * COVER_ZOOM.min) / clampZoom(zoom);
  return { width: unit * COVER_RATIO.width, height: unit * COVER_RATIO.height };
}

/** Dat khung co goc tai (x, y); khung lo ra ngoai mep thi bi day vao trong anh. */
function place(size: ImageSize, zoom: number, x: number, y: number): CropState {
  const frame = frameSize(size, zoom);
  return {
    x: clamp(x, 0, Math.max(0, size.width - frame.width)),
    y: clamp(y, 0, Math.max(0, size.height - frame.height)),
    zoom: clampZoom(zoom),
  };
}

/** Buoc cat luc vua chon anh: khung lon nhat, nam giua anh. */
export function initialCrop(size: ImageSize): CropState {
  const frame = frameSize(size, COVER_ZOOM.min);
  return place(size, COVER_ZOOM.min, (size.width - frame.width) / 2, (size.height - frame.height) / 2);
}

/** Khung cat cua trang thai, diem anh nguon: vua la toa do ve khung trong san cat, vua la phan anh dem cat. */
export function cropRect(size: ImageSize, crop: CropState): CropRect {
  return { x: crop.x, y: crop.y, ...frameSize(size, crop.zoom) };
}

/** Doi muc thu phong: khung thu hoac gian quanh tam cu, roi duoc day vao trong anh. */
export function zoomCrop(size: ImageSize, crop: CropState, zoom: number): CropState {
  const before = frameSize(size, crop.zoom);
  const after = frameSize(size, zoom);
  return place(size, zoom, crop.x + (before.width - after.width) / 2, crop.y + (before.height - after.height) / 2);
}

/**
 * Doi khung bang phim mui ten: moi lan CROP_STEP canh dai cua anh, far (giu Shift) thi CROP_STEP_FAR. Tinh theo canh dai
 * de anh doc hay anh ngang deu doi nhanh nhu nhau. Phim khac tra null de trinh duyet xu ly nhu thuong.
 */
export function keyCrop(size: ImageSize, crop: CropState, key: string, far: boolean): CropState | null {
  if (!Object.hasOwn(ARROWS, key)) return null;
  const [dx, dy] = ARROWS[key];
  const step = Math.max(size.width, size.height) * (far ? CROP_STEP_FAR : CROP_STEP);
  return place(size, crop.zoom, crop.x + dx * step, crop.y + dy * step);
}

/**
 * Keo khung: start la trang thai luc bat dau keo, (dx, dy) la quang con tro da di tren man hinh, box la kich thuoc hien
 * cua san cat. San ve anh bang SVG giu ti le (canh giua trong san), nen mot diem man hinh bang so diem anh lon hon trong
 * hai chieu. San chua co kich thuoc thi khung dung yen.
 */
export function dragCrop(size: ImageSize, start: CropState, box: { width: number; height: number }, dx: number, dy: number): CropState {
  if (box.width <= 0 || box.height <= 0) return start;
  const scale = Math.max(size.width / box.width, size.height / box.height);
  return place(size, start.zoom, start.x + dx * scale, start.y + dy * scale);
}

/**
 * Kich thuoc anh bia gui len tu mot khung cat: dung COVER_RATIO bang so nguyen, rong toi da IMAGE_MAX_WIDTH_PX
 * (1200x720), va khong phong to khung nho hon nen khong gui diem anh gia. Nho nhat la mot don vi ti le (5x3).
 */
export function coverOutputSize(rect: CropRect): { width: number; height: number } {
  const units = clamp(Math.floor(rect.width / COVER_RATIO.width), 1, IMAGE_MAX_WIDTH_PX / COVER_RATIO.width);
  return { width: units * COVER_RATIO.width, height: units * COVER_RATIO.height };
}

import { checkImageSource, decodeResizeWidth, type ImageFailure } from "@/lib/media/image";
import { HEADER_BYTES, readSourceHeader } from "@/lib/media/source-kind";
import { loadHeif } from "./loadHeif";

/**
 * Anh goc da giai ma, san sang ve len canvas: nguon ve, kich thuoc da xoay theo huong chup, va ham tra bo nho (dong bitmap
 * hay thu hoi blob URL). Noi goi goi release dung mot lan khi khong ve nua.
 */
export type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Cac cach giai ma. Tach ra de kiem duoc thu tu thu ma khong can trinh duyet that. */
export type DecodeTiers = {
  bitmap: (file: Blob, options?: ImageBitmapOptions) => Promise<ImageBitmap>;
  element: (file: Blob) => Promise<DecodedImage>;
  heif: () => Promise<(file: Blob) => Promise<ImageBitmap>>;
};

export type DecodeOptions = {
  /** Goi ngay truoc khi nap bo doc HEIF: buoc nay mat vai giay, man hinh nen bao dang doc anh. */
  onHeif?: () => void;
  tiers?: DecodeTiers;
};

function fromBitmap(bitmap: ImageBitmap): DecodedImage {
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
}

/** Tang the img: trinh duyet hien dai tu xoay theo EXIF khi ve the img. Blob URL song toi khi release. */
async function decodeWithElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new Error("anh khong co diem anh");
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

export const BROWSER_TIERS: DecodeTiers = {
  bitmap: (file, options) => (options ? createImageBitmap(file, options) : createImageBitmap(file)),
  element: decodeWithElement,
  heif: loadHeif,
};

/** Ket qua cua mot lan thu, hoac null khi no nem: moi tang hong deu chi co nghia la thu tang sau. */
async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/**
 * Giai ma tep anh goc cho moi noi tai anh (anh trong trang va bia), thu lan luot toi khi co anh:
 * 1. createImageBitmap xoay theo EXIF; biet truoc anh qua DECODE_MAX_PIXELS thi thu nho ngay luc giai ma;
 * 2. createImageBitmap khong tuy chon, cho trinh duyet cu nem loi voi tui tuy chon;
 * 3. the img (decode()), noi goi ve len canvas;
 * 4. tep HEIF theo byte dau (Chrome, Edge, Firefox khong doc duoc HEIC): nap bo doc HEIF roi giai ma.
 * Loai tep doc tu byte dau, khong tin file.type. Loi: qua tran goc, loai khong nhan, khong nap duoc bo doc HEIF (mat
 * mang), hoac moi cach deu hong.
 */
export async function decodeImage(file: Blob, { onHeif, tiers = BROWSER_TIERS }: DecodeOptions = {}): Promise<DecodedImage | ImageFailure> {
  const tooLarge = checkImageSource(file);
  if (tooLarge) return tooLarge;
  const head = await attempt(() => file.slice(0, HEADER_BYTES).arrayBuffer());
  if (!head) return "broken";
  const header = readSourceHeader(new Uint8Array(head));
  if (!header) return "unsupported";
  const resizeWidth = decodeResizeWidth(header.size);
  const oriented: ImageBitmapOptions = resizeWidth === null
    ? { imageOrientation: "from-image" }
    : { imageOrientation: "from-image", resizeWidth, resizeQuality: "high" };
  const bitmap = (await attempt(() => tiers.bitmap(file, oriented))) ?? (await attempt(() => tiers.bitmap(file)));
  if (bitmap) return fromBitmap(bitmap);
  const element = await attempt(() => tiers.element(file));
  if (element) return element;
  if (header.kind !== "heif") return "broken";
  onHeif?.();
  const decodeHeif = await attempt(tiers.heif);
  if (!decodeHeif) return "heif-loader";
  const heif = await attempt(() => decodeHeif(file));
  return heif ? fromBitmap(heif) : "broken";
}

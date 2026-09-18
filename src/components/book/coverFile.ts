import { canvasBlob, decodeImage, encodeCanvas, paintCanvas } from "@/components/media/imageCanvas";
import { coverOutputSize, type CropRect, type ImageSize } from "@/lib/media/crop";
import type { ImageFailure } from "@/lib/media/image";
import { MEDIA_MAX_BYTES } from "@/lib/media/kinds";

/** Canh dai nhat cua anh xem truoc trong buoc cat: du net tren man lon, nhe hon anh goc nhieu lan. */
const PREVIEW_MAX_SIDE = 1600;
const PREVIEW_QUALITY = 0.8;

/** Anh goc da giai ma cho buoc cat: bitmap da xoay theo EXIF, kich thuoc cua no va blob URL cua anh xem truoc. */
export type SourceImage = { bitmap: ImageBitmap; size: ImageSize; previewUrl: string };

/**
 * Doc tep anh goc cho buoc cat bang decodeImage: qua tran goc thi lon qua, trinh duyet khong giai ma duoc thi
 * khong doc duoc. Anh xem truoc ve lai tu chinh bitmap do, nen khung cat trong san va phan anh dem cat luon khop nhau.
 * Noi goi giai phong bang releaseSourceImage.
 */
export async function readSourceImage(file: File): Promise<SourceImage | ImageFailure> {
  const bitmap = await decodeImage(file);
  if (typeof bitmap === "string") return bitmap;
  const size = { width: bitmap.width, height: bitmap.height };
  const k = Math.min(1, PREVIEW_MAX_SIDE / Math.max(size.width, size.height));
  const width = Math.max(1, Math.round(size.width * k));
  const height = Math.max(1, Math.round(size.height * k));
  const canvas = paintCanvas(width, height, (ctx) => ctx.drawImage(bitmap, 0, 0, width, height));
  const preview = canvas && (await canvasBlob(canvas, "image/jpeg", PREVIEW_QUALITY));
  // Byte cua anh xem truoc da nam trong blob: tra bo dem canvas (toi 1600 canh dai) lai ngay, cung ly do nhu encodeCanvas.
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
  if (!preview) {
    bitmap.close();
    return canvas ? "unreadable" : "too-large";
  }
  return { bitmap, size, previewUrl: URL.createObjectURL(preview) };
}

/** Giai phong anh goc: dong bitmap, thu hoi blob URL xem truoc. */
export function releaseSourceImage(source: SourceImage): void {
  source.bitmap.close();
  URL.revokeObjectURL(source.previewUrl);
}

/**
 * Cat va ma hoa anh bia: phan rect cua anh goc ve vao canvas coverOutputSize (5:3, toi da 1200x720), roi encodeCanvas
 * trong tran MEDIA_MAX_BYTES.bia (may chu kiem lai). Anh goc duoc ve xong truoc lan cho dau tien, nen giai phong no ngay
 * sau khi goi ham nay van an toan.
 */
export async function encodeCover(source: SourceImage, rect: CropRect): Promise<Blob | ImageFailure> {
  const out = coverOutputSize(rect);
  const canvas = paintCanvas(out.width, out.height, (ctx) =>
    ctx.drawImage(source.bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height));
  return canvas ? encodeCanvas(canvas, MEDIA_MAX_BYTES.bia) : "too-large";
}

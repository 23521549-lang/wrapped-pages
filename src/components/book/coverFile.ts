import { decodeImage, type DecodedImage } from "@/components/media/decodeImage";
import { canvasBlob, encodeCanvas, paintCanvas } from "@/components/media/imageCanvas";
import { coverOutputSize, type CropRect, type ImageSize } from "@/lib/media/crop";
import type { ImageFailure } from "@/lib/media/image";
import { MEDIA_MAX_BYTES } from "@/lib/media/kinds";

/** Canh dai nhat cua anh xem truoc trong buoc cat: du net tren man lon, nhe hon anh goc nhieu lan. */
const PREVIEW_MAX_SIDE = 1600;
const PREVIEW_QUALITY = 0.8;

/** Anh goc da giai ma cho buoc cat: anh da xoay theo huong chup, kich thuoc cua no va blob URL cua anh xem truoc. */
export type SourceImage = { image: DecodedImage; size: ImageSize; previewUrl: string };

/**
 * Doc tep anh goc cho buoc cat bang decodeImage (moi loi cua no tra thang ve). Anh xem truoc ve lai tu chinh anh da giai
 * ma, nen khung cat trong san va phan anh dem cat luon khop nhau. Noi goi giai phong bang releaseSourceImage.
 */
export async function readSourceImage(file: File, options: { onHeif?: () => void } = {}): Promise<SourceImage | ImageFailure> {
  const image = await decodeImage(file, options);
  if (typeof image === "string") return image;
  try {
    const size = { width: image.width, height: image.height };
    const k = Math.min(1, PREVIEW_MAX_SIDE / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * k));
    const height = Math.max(1, Math.round(size.height * k));
    const canvas = paintCanvas(width, height, (ctx) => ctx.drawImage(image.source, 0, 0, width, height));
    const preview = canvas && (await canvasBlob(canvas, "image/jpeg", PREVIEW_QUALITY));
    // Byte cua anh xem truoc da nam trong blob: tra bo dem canvas (toi 1600 canh dai) lai ngay, cung ly do nhu encodeCanvas.
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (!preview) {
      image.release();
      return canvas ? "broken" : "too-large";
    }
    return { image, size, previewUrl: URL.createObjectURL(preview) };
  } catch (err) {
    // ve (drawImage) hay ma hoa xem truoc (toBlob) nem loi thay vi tra null (vd ImageBitmap bi dong o noi khac giua
    // chung): giai phong anh goc ngay o day, khong thi ro ri bo nho toi khi ai do dong tab hay lam moi trang.
    image.release();
    throw err;
  }
}

/** Giai phong anh goc: tra bo nho cua anh da giai ma, thu hoi blob URL xem truoc. */
export function releaseSourceImage(source: SourceImage): void {
  source.image.release();
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
    ctx.drawImage(source.image.source, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height));
  return canvas ? encodeCanvas(canvas, MEDIA_MAX_BYTES.bia) : "too-large";
}

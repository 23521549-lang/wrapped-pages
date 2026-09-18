import { decodeImage, encodeCanvas, paintCanvas } from "@/components/media/imageCanvas";
import { fitImage, type ImageFailure } from "@/lib/media/image";
import { MEDIA_MAX_BYTES } from "@/lib/media/kinds";

export type ProcessedImage = { blob: Blob; width: number; height: number };

/**
 * Xu ly anh trong trang truoc khi tai len: giai ma va xoay theo EXIF (decodeImage), ve lai tren canvas co fitImage,
 * ma hoa WebP, dong JPEG, trong tran MEDIA_MAX_BYTES.anh (encodeCanvas). Canvas khong cap duoc context la lon qua.
 */
export async function processImage(file: File): Promise<ProcessedImage | { problem: ImageFailure }> {
  const bitmap = await decodeImage(file);
  if (typeof bitmap === "string") return { problem: bitmap };
  try {
    const { width, height } = fitImage(bitmap.width, bitmap.height);
    const canvas = paintCanvas(width, height, (ctx) => ctx.drawImage(bitmap, 0, 0, width, height));
    if (!canvas) return { problem: "too-large" };
    const blob = await encodeCanvas(canvas, MEDIA_MAX_BYTES.anh);
    return typeof blob === "string" ? { problem: blob } : { blob, width, height };
  } finally {
    bitmap.close();
  }
}

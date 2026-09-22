import { decodeImage } from "@/components/media/decodeImage";
import { encodeCanvas, paintCanvas } from "@/components/media/imageCanvas";
import { fitImage, type ImageFailure } from "@/lib/media/image";
import { MEDIA_MAX_BYTES } from "@/lib/media/kinds";

export type ProcessedImage = { blob: Blob; width: number; height: number };

/**
 * Xu ly anh trong trang truoc khi tai len: giai ma nhieu tang (decodeImage, xoay theo huong chup), ve lai tren canvas co
 * fitImage, ma hoa WebP, dong JPEG, trong tran MEDIA_MAX_BYTES.anh (encodeCanvas). Canvas khong cap duoc context la
 * lon qua. onHeif bao man hinh luc bat dau doc anh HEIF (mat vai giay).
 */
export async function processImage(file: File, options: { onHeif?: () => void } = {}): Promise<ProcessedImage | { problem: ImageFailure }> {
  const image = await decodeImage(file, options);
  if (typeof image === "string") return { problem: image };
  try {
    const { width, height } = fitImage(image.width, image.height);
    const canvas = paintCanvas(width, height, (ctx) => ctx.drawImage(image.source, 0, 0, width, height));
    if (!canvas) return { problem: "too-large" };
    const blob = await encodeCanvas(canvas, MEDIA_MAX_BYTES.anh);
    return typeof blob === "string" ? { problem: blob } : { blob, width, height };
  } finally {
    image.release();
  }
}

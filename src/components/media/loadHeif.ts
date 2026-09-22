/**
 * Nap bo doc HEIF (anh iPhone) tu mot manh ma rieng, chi khi gap tep HEIF ma trinh duyet khong tu doc duoc. Tach thanh
 * mo dun rieng de kiem duoc ca truong hop mat mang giua chung (import dong that bai).
 */
export async function loadHeif(): Promise<(file: Blob) => Promise<ImageBitmap>> {
  const { decodeHeif } = await import("./heif");
  return decodeHeif;
}

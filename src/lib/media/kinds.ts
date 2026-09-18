/**
 * Ba loai media: anh trong trang, ghi am trong trang, bia tu tai len. Cac danh sach va tran trong
 * CHECK cua bang media phai khop dung cac hang so o day (co test).
 */
export const MEDIA_KINDS = ["anh", "ghi-am", "bia"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Anh va bia: WebP ve lai tu canvas, JPEG khi trinh duyet khong ma hoa duoc WebP. */
export const IMAGE_MIMES = ["image/webp", "image/jpeg"] as const;
/** Ghi am: WebM/Opus truoc, MP4 cho Safari. */
export const AUDIO_MIMES = ["audio/webm", "audio/mp4"] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];
export type AudioMime = (typeof AUDIO_MIMES)[number];
export type MediaMime = ImageMime | AudioMime;

/** Mime duoc nhan theo tung loai. */
export const MEDIA_MIMES = {
  anh: IMAGE_MIMES,
  "ghi-am": AUDIO_MIMES,
  bia: IMAGE_MIMES,
} as const satisfies Record<MediaKind, readonly MediaMime[]>;

const MB = 1024 * 1024;

/** Tran byte cua mot tep theo loai. Anh da thu nho o trinh duyet nen duoi 1 MB. */
export const MEDIA_MAX_BYTES = { anh: MB, "ghi-am": 2 * MB, bia: MB } as const satisfies Record<MediaKind, number>;

/**
 * Tran tong cho ca kho tep: 8 GiB, duoi han muc 10 GB cua goi free Cloudflare R2. saveUpload cong so byte dang co
 * trong bang media truoc khi put, nen web la noi tu choi khi kho gan day, khong phai nha cung cap.
 */
export const MEDIA_TOTAL_MAX_BYTES = 8 * 1024 * 1024 * 1024;

/** Ghi am dai toi da 3 phut. */
export const AUDIO_MAX_MS = 180_000;
/** So cot song am tinh luc ghi, moi cot la so nguyen tu 0 toi PEAK_MAX. */
export const PEAK_COUNT = 48;
export const PEAK_MAX = 100;

/** Kich thuoc toi da cua anh sau khi trinh duyet thu nho. */
export const IMAGE_MAX_WIDTH_PX = 1200;
export const IMAGE_MAX_HEIGHT_PX = 1600;

/** Bia cat dung 5:3, cung ti le voi khung tranh bia ve san. */
export const COVER_RATIO = { width: 5, height: 3 } as const;

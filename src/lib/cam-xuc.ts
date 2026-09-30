import { momentLabel } from "@/lib/when";

/*
 * Kho cam xuc (dot nam 5d): tam cam xuc, moi cam xuc mot linh vat 3D rieng (bo Fluent Emoji Animated cua Microsoft,
 * giay phep MIT, tu phuc vu o public/linh-vat/). Linh vat mac dinh la Chip, ga con: ngoi goc moi trang, hoa thanh linh
 * vat cua cam xuc khi mang cam xuc toi, phan 5e cho no biet noi. Ham thuan, khong import react, next hay drizzle.
 */

/** Tam loai, dung thu tu; khop CHECK cam_xuc_loai (co test). */
export const LOAI_CAM_XUC = ["yeu", "nho", "vui", "buon", "gian", "bat-ngo", "treu", "biet-on"] as const;
export type LoaiCamXuc = (typeof LOAI_CAM_XUC)[number];

/** Hai lan tha cua cung mot nguoi cach nhau it nhat chung nay (may chu chan). */
export const CACH_THA_MS = 10_000;

/** Nguoi vang lau quay lai chi xem nhieu nhat chung nay cam xuc moi nhat; cu hon thi coi nhu da xem. */
export const TOI_DA_HANG_CHO = 3;

export type LinhVat = {
  /** Ten goi cua linh vat ("Gấu bông"). */
  ten: string;
  /** Duong dan anh dong (WebP, 192px, lap vo han). */
  anh: string;
  /** Anh tinh (khung dau), cho che do giam chuyen dong. */
  anhTinh: string;
};

export type CamXuc = LinhVat & {
  /** Ten cam xuc hien o kho va dong Hoat dong ("Yêu"). */
  camXuc: string;
  /** Cau linh vat noi voi nguoi nhan, sau ten nguoi tha: "{A} đang cảm thấy yêu bạn". */
  cau: string;
};

const anh = (ten: string): Pick<LinhVat, "anh" | "anhTinh"> => ({ anh: `/linh-vat/${ten}.webp`, anhTinh: `/linh-vat/${ten}-tinh.webp` });

/** Linh vat mac dinh: Chip, ga con. */
export const CHIP: LinhVat = { ten: "Chíp", ...anh("chip") };

export const CAM_XUC: Record<LoaiCamXuc, CamXuc> = {
  yeu: { camXuc: "Yêu", ten: "Gấu bông", cau: "đang cảm thấy yêu bạn", ...anh("gau-bong") },
  nho: { camXuc: "Nhớ", ten: "Gấu túi", cau: "đang nhớ bạn", ...anh("gau-tui") },
  vui: { camXuc: "Vui", ten: "Cá heo", cau: "đang vui lắm", ...anh("ca-heo") },
  buon: { camXuc: "Buồn", ten: "Chim cánh cụt", cau: "đang buồn", ...anh("chim-canh-cut") },
  gian: { camXuc: "Giận", ten: "Hổ con", cau: "đang giận bạn đó", ...anh("ho-con") },
  "bat-ngo": { camXuc: "Bất ngờ", ten: "Cú mèo", cau: "bất ngờ quá", ...anh("cu-meo") },
  treu: { camXuc: "Trêu", ten: "Khỉ con", cau: "đang muốn trêu bạn", ...anh("khi-con") },
  "biet-on": { camXuc: "Biết ơn", ten: "Gấu trúc", cau: "cảm ơn bạn nhiều", ...anh("gau-truc") },
};

/** Chuoi la mot trong tam loai khong. */
export function laLoaiCamXuc(x: unknown): x is LoaiCamXuc {
  return typeof x === "string" && (LOAI_CAM_XUC as readonly string[]).includes(x);
}

/**
 * Dong nho duoi cau linh vat noi: "Gấu bông mang tới, vừa xong", ", 20 phút trước", hay " lúc hôm qua, 21:04" khi da qua
 * mot gio (momentLabel, gio Viet Nam).
 */
export function dongMangToi(ten: string, luc: Date, now: Date): string {
  const giay = Math.max(0, (now.getTime() - luc.getTime()) / 1000);
  if (giay < 60) return `${ten} mang tới, vừa xong`;
  if (giay < 3600) return `${ten} mang tới, ${Math.floor(giay / 60)} phút trước`;
  return `${ten} mang tới lúc ${momentLabel(luc, now)}`;
}

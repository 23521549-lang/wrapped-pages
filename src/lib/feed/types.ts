import type { SealKind } from "@/lib/seal/types";
import type { Weather } from "@/lib/tam-trang/troi";

/**
 * Muoi lam loai su kien cua dong Hoat dong: tam loai cu, roi bay loai cua dot nam (tha tam trang, tao sach, doi ten,
 * doi bia, doi nhac, sua trang, da doc). Danh sach trong CHECK activity_kind cua bang activity phai khop dung danh sach
 * nay, ca thu tu (co test).
 */
export const FEED_KINDS = [
  "dang-trang", "moi-trao-doi", "mo-hen-gio", "mo-trang", "thu-sai", "tang-khoa", "doi-mat-khau", "hoi-dap",
  "tha-tam-trang", "tao-sach", "doi-ten-sach", "doi-bia", "doi-nhac", "sua-trang", "da-doc",
] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

/** Nam loai gan mot niem phong: CHECK activity_niem_phong bat buoc seal_id cho tung loai. */
export const LOAI_NIEM_PHONG = ["moi-trao-doi", "mo-hen-gio", "mo-trang", "thu-sai", "tang-khoa"] as const satisfies readonly FeedKind[];
export type LoaiNiemPhong = (typeof LOAI_NIEM_PHONG)[number];

/** Loai co cot detail (CHECK activity_detail); doc bang cac ham cua src/lib/feed/detail.ts. */
export const LOAI_CO_CHI_TIET = ["doi-ten-sach", "doi-bia", "doi-nhac", "da-doc"] as const satisfies readonly FeedKind[];

/** Ai lam: chinh nguoi xem hay nguoi kia. Dong Hoat dong khong bao gio mang id tai khoan. */
export type FeedActor = "me" | "partner";

/**
 * Mot dong cua khung Hoat dong gui cho giao dien, nhu listActivity doc ra. Cac lan thu sai cung nguoi, cung niem
 * phong, cung ngay gio Viet Nam da duoc gom thanh mot dong ngay trong SQL.
 */
export type FeedItem = {
  id: string;
  kind: FeedKind;
  by: FeedActor;
  at: Date;
  bookId: string | null;
  bookTitle: string | null;
  firstPosition: number | null;
  lastPosition: number | null;
  sealKind: SealKind | null;
  /** Loi nhan, join luc doc: loi nhan tang chia khoa (tang-khoa) hay loi nhan cua tam trang (tha-tam-trang); con lai null. */
  note: string | null;
  /** So lan thu sai da gom vao dong nay; moi loai khac luon 1. */
  count: number;
  /** Viec cua nguoi kia ma nguoi xem chua xem (hay dong da doi tu lan xem truoc). Viec cua minh luon false. */
  isNew: boolean;
  /** Cot detail tho; doc bang ham cua src/lib/feed/detail.ts theo loai. */
  detail: unknown;
  /** Kieu troi cua tam trang vua tha (tha-tam-trang); con lai null. */
  weather: Weather | null;
  /** dang-trang: luot co o bia rieng, o nhac rieng (doi bia, doi nhac cung lan dang). */
  biaMoi: boolean;
  nhacMoi: boolean;
  /** doi-bia, doi-nhac: so thu tu luot cua o; null la o mo dau luc tao sach (va moi loai khac). */
  ordinal: number | null;
};

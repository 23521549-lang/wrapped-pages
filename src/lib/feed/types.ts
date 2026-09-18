import type { SealKind } from "@/lib/seal/types";

/**
 * Bay loai su kien cua dong Hoat dong. Danh sach trong CHECK activity_kind cua bang activity phai
 * khop dung danh sach nay, ca thu tu (co test).
 */
export const FEED_KINDS = [
  "dang-trang", "moi-trao-doi", "mo-hen-gio", "mo-trang", "thu-sai", "tang-khoa", "doi-mat-khau",
] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

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
  /** Loi nhan tang chia khoa, join luc doc. Chi dong tang-khoa co; moi loai khac luon null. */
  note: string | null;
  /** So lan thu sai da gom vao dong nay; moi loai khac luon 1. */
  count: number;
};

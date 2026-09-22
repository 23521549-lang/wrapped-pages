import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { findOwnBook, findReadableBook } from "@/server/library/books";
import { requireMe } from "./guard";

/*
 * Cong cua cac man co the 404 (/sach/[id] va man con). Goi tu layout.tsx, tuc la TRUOC ranh gioi loading.tsx cung
 * doan: layout chay xong moi toi khung giu cho, nen notFound() va redirect() o day van tra dung ma 404 va 307. Neu de
 * cho trang tu kiem ben trong ranh gioi thi phan hoi da bat dau stream (ma 200) truoc khi trang biet cuon do co doc
 * duoc hay khong.
 * Thu tu giu nguyen: dang nhap truoc (requireMe), roi moi doc sach.
 *
 * Cong chi chay khi trinh duyet tai ca trang (tai lieu HTML). Yeu cau RSC (tai truoc lien ket, chuyen man phia
 * trinh duyet) khong co ma trang thai nao de giu, va trang van tu kiem dang nhap lan quyen doc nhu truoc; bo cong o do
 * giu cho phan tai truoc khung giu cho khong cham database. Thieu header Sec-Fetch-Dest (khong phai trinh duyet) thi
 * coi nhu tai trang, tuc van chay cong.
 */
async function laTaiTrang(): Promise<boolean> {
  return (await headers()).get("sec-fetch-dest") !== "empty";
}

/** Cuon cua chinh nguoi dang vao. cache() de cong va trang dung chung mot lan doc trong cung request. */
export const sachCuaToi = cache((accountId: string, bookId: string) => findOwnBook(db, accountId, bookId));

/** Man doc: cuon cua minh hoac cuon chia se cua nguoi kia. */
export async function congDoc(bookId: string): Promise<void> {
  if (!(await laTaiTrang())) return;
  const me = await requireMe();
  if (!(await findReadableBook(db, me.accountId, bookId))) notFound();
}

/** Man viet, man sua sach: chi cuon cua chinh minh. */
export async function congSachCuaToi(bookId: string): Promise<void> {
  if (!(await laTaiTrang())) return;
  const me = await requireMe();
  if (!(await sachCuaToi(me.accountId, bookId))) notFound();
}

/** Mau chat cho so trang hay so luot tren duong dan: khong nhan 1e3, 0x10, khoang trang hay so 0 dau. */
export const SO_TRANG = /^[1-9][0-9]{0,4}$/;

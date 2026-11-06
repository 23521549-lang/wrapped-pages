import { describe, expect, it } from "vitest";
import { createBook, updateBook } from "@/server/library/books";
import { deNghiCuaSach, deNghiToiToi, xinViet } from "@/server/viet-cung/de-nghi";
import { haiCuon } from "../helpers/library";

const T = new Date("2026-09-22T02:00:00.000Z");
const sau = (phut: number) => new Date(T.getTime() + phut * 60_000);

/*
 * Khoang Lang tren de nghi viet cung (task 10): tat co thi thay de nghi doi phuong; bat co thi khong con de nghi nao do
 * doi phuong gui o bat cu dau, nhung de nghi do minh gui van doc duoc de rut lai.
 */
async function dung() {
  const s = await haiCuon();
  const { db, seat1, seat2, chung, rieng } = s;
  const cuonManh = await createBook(db, seat2.id, { title: "Chạy bộ mùa thu", mode: "chia-se", cover: "cau-go", youtubeId: null, coverMediaId: null });
  await xinViet(db, seat2.id, chung, T);
  await updateBook(db, seat2.id, cuonManh, { title: "Chạy bộ mùa thu", mode: "chia-se", moi: true }, sau(1));
  await updateBook(db, seat1.id, rieng, { title: "Cuốn không đặt tên", mode: "chia-se", moi: true }, sau(2));
  return { ...s, cuonManh };
}

describe("Khoang Lang: de nghi viet cung", () => {
  it("tat co (kiem soat duong): deNghiToiToi co de nghi doi phuong; deNghiCuaSach thay ca hai chieu", async () => {
    const { db, seat1, seat2, chung, rieng, cuonManh } = await dung();
    expect(await deNghiToiToi(db, seat1.id)).toEqual([
      { bookId: cuonManh, title: "Chạy bộ mùa thu", loai: "moi-viet", luc: sau(1) },
      { bookId: chung, title: "Chuyện chưa kể", loai: "xin-viet", luc: T },
    ]);
    expect(await deNghiCuaSach(db, seat1.id, chung)).toEqual({ loai: "xin-viet", cuaToi: false });
    expect(await deNghiCuaSach(db, seat2.id, chung)).toEqual({ loai: "xin-viet", cuaToi: true });
    expect(await deNghiCuaSach(db, seat1.id, rieng)).toEqual({ loai: "moi-viet", cuaToi: true });
  });

  it("bat co: deNghiToiToi rong; de nghi doi phuong an, de nghi cua minh van doc duoc", async () => {
    const { db, seat1, seat2, chung, rieng } = await dung();
    expect(await deNghiToiToi(db, seat1.id, true)).toEqual([]);
    expect(await deNghiToiToi(db, seat2.id, true)).toEqual([]);
    // De nghi cua doi phuong (Manh xin viet cuon cua Linh): Linh khong thay nua.
    expect(await deNghiCuaSach(db, seat1.id, chung, true)).toBeNull();
    // De nghi do minh gui van doc duoc de rut lai: loi xin cua Manh, loi moi cua Linh.
    expect(await deNghiCuaSach(db, seat2.id, chung, true)).toEqual({ loai: "xin-viet", cuaToi: true });
    expect(await deNghiCuaSach(db, seat1.id, rieng, true)).toEqual({ loai: "moi-viet", cuaToi: true });
  });
});

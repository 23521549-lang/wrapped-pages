import { describe, expect, it } from "vitest";
import { deNghiCuaSach } from "@/server/viet-cung/de-nghi";
import { xinViet } from "@/server/viet-cung/de-nghi";
import { demCauLenh } from "../helpers/db";
import { haiCuon } from "../helpers/library";

/*
 * NGAN SACH TRUY VAN cua deNghiCuaSach. Truoc day ham nay doc qua readSnapshot (1 SELECT cong 3 cau mo/dong anh
 * chup) trong khi no chi co dung mot SELECT don - von da nguyen tu, khong can anh chup. Bai nay khoa lai: dung
 * 1 cau lenh.
 */

const T = new Date("2026-09-22T02:00:00.000Z");

describe("ngan sach truy van cua deNghiCuaSach", () => {
  it("chi 1 cau SELECT, khong mo anh chup", async () => {
    const { db, seat2, chung } = await haiCuon();
    await xinViet(db, seat2.id, chung, T);
    const so = await demCauLenh(async () => {
      expect(await deNghiCuaSach(db, seat2.id, chung)).toEqual({ loai: "xin-viet", cuaToi: true });
    });
    expect(so).toBe(1);
  });
});

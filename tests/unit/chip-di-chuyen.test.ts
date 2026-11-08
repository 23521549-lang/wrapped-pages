import { describe, expect, it } from "vitest";
import {
  bezier,
  canhCuaDiem,
  CAU_DAO_CHOI,
  chonDiemDen,
  diemGoc,
  duongDi,
  ease,
  heSoTho,
  oGiuaManHinh,
  oTrongDaiMep,
  thoiGianDi,
  tinhBanking,
  type Diem,
  type HinhChuNhat,
} from "@/components/linh-vat/di-chuyen";

/*
 * Engine di chuyen cua Chip (ham thuan): diem den luon tren 4 dai mep, loai vung cam, fallback ve goc; duong di
 * Bezier om canh (cung canh 1 doan, ke nhau 1 doan qua goc chung, doi nhau 3 doan men theo mot ben); banking theo
 * ca hai truc van toc.
 */

const RONG = 1280;
const CAO = 800;
const CO = 64;
const LE = 16;
/** Ham ngau nhien xac dinh: luon tra 0.5 (canh giua, lech dieu khien bang 0, ben phai khi chon ben). */
const NUA = () => 0.5;
const GOC: Diem = { x: LE, y: CAO - LE - CO };

describe("diemGoc va canhCuaDiem", () => {
  it("goc la duoi trai", () => {
    expect(diemGoc(RONG, CAO, CO, LE)).toEqual(GOC);
  });

  it("phan loai dung 4 canh", () => {
    expect(canhCuaDiem({ x: 600, y: LE }, RONG, CAO, CO)).toBe("tren");
    expect(canhCuaDiem({ x: 600, y: CAO - LE - CO }, RONG, CAO, CO)).toBe("duoi");
    expect(canhCuaDiem({ x: LE, y: 400 }, RONG, CAO, CO)).toBe("trai");
    expect(canhCuaDiem({ x: RONG - LE - CO, y: 400 }, RONG, CAO, CO)).toBe("phai");
  });

  it("oTrongDaiMep dung cho diem tren mep va giua man", () => {
    expect(oTrongDaiMep({ x: 600, y: LE }, RONG, CAO, CO, LE)).toBe(true);
    expect(oTrongDaiMep({ x: LE, y: 400 }, RONG, CAO, CO, LE)).toBe(true);
    expect(oTrongDaiMep({ x: 600, y: 400 }, RONG, CAO, CO, LE)).toBe(false);
  });

  it("oGiuaManHinh dung cho tam va goc", () => {
    expect(oGiuaManHinh(RONG / 2, CAO / 2, RONG, CAO)).toBe(true);
    expect(oGiuaManHinh(LE, LE, RONG, CAO)).toBe(false);
    expect(oGiuaManHinh(RONG - LE, CAO - LE, RONG, CAO)).toBe(false);
  });
});

describe("chonDiemDen", () => {
  it("diem den luon trong dai mep, nhieu lan lay mau", () => {
    for (let i = 0; i < 200; i += 1) {
      const d = chonDiemDen(RONG, CAO, CO, LE, []);
      expect(oTrongDaiMep(d, RONG, CAO, CO, LE)).toBe(true);
      expect(d.x).toBeGreaterThanOrEqual(LE);
      expect(d.x).toBeLessThanOrEqual(RONG - LE - CO);
      expect(d.y).toBeGreaterThanOrEqual(LE);
      expect(d.y).toBeLessThanOrEqual(CAO - LE - CO);
    }
  });

  it("khong dau trong vung cam (da cong dem 24px)", () => {
    const cam: HinhChuNhat[] = [{ x: 1000, y: 700, rong: 280, cao: 100 }];
    for (let i = 0; i < 200; i += 1) {
      const d = chonDiemDen(RONG, CAO, CO, LE, cam);
      const roi = d.x + CO > cam[0].x - 24 && d.x < cam[0].x + cam[0].rong + 24 && d.y + CO > cam[0].y - 24 && d.y < cam[0].y + cam[0].cao + 24;
      expect(roi).toBe(false);
    }
  });

  it("het 14 lan thu thi ve goc duoi trai", () => {
    const phuHet: HinhChuNhat[] = [{ x: 0, y: 0, rong: RONG, cao: CAO }];
    expect(chonDiemDen(RONG, CAO, CO, LE, phuHet, NUA)).toEqual(GOC);
  });

  it("moi canh deu co the duoc chon", () => {
    const thay = new Set<string>();
    let i = 0;
    while (thay.size < 4 && i < 2000) {
      i += 1;
      thay.add(canhCuaDiem(chonDiemDen(RONG, CAO, CO, LE, []), RONG, CAO, CO));
    }
    expect(thay).toEqual(new Set(["tren", "duoi", "trai", "phai"]));
  });
});

describe("duongDi", () => {
  it("cung canh: 1 doan, diem dieu khien giua hai dau", () => {
    const doan = duongDi({ x: 100, y: LE }, { x: 500, y: LE }, RONG, CAO, CO, LE, NUA);
    expect(doan).toHaveLength(1);
    expect(doan[0]).toMatchObject({ x0: 100, y0: LE, x1: 500, y1: LE, cx: 300, cy: LE });
  });

  it("hai canh ke: 1 doan, diem dieu khien la goc chung", () => {
    const doan = duongDi({ x: 100, y: LE }, { x: RONG - LE - CO, y: 300 }, RONG, CAO, CO, LE, NUA);
    expect(doan).toHaveLength(1);
    expect(doan[0]).toMatchObject({ x0: 100, y0: LE, x1: RONG - LE - CO, y1: 300, cx: RONG - LE - CO, cy: LE });
  });

  it("hai canh doi nhau: 3 doan men theo mot ben, dau noi dau", () => {
    const tu = { x: 100, y: LE };
    const den = { x: 500, y: CAO - LE - CO };
    const doan = duongDi(tu, den, RONG, CAO, CO, LE, NUA);
    expect(doan).toHaveLength(3);
    // Ben phai (ngau nhien 0.5 khong nho hon 0.5): qua goc tren phai roi goc duoi phai.
    expect(doan[0]).toMatchObject({ x0: 100, y0: LE, x1: RONG - LE - CO, y1: LE });
    expect(doan[1]).toMatchObject({ x0: RONG - LE - CO, y0: LE, x1: RONG - LE - CO, y1: CAO - LE - CO });
    expect(doan[2]).toMatchObject({ x0: RONG - LE - CO, y0: CAO - LE - CO, x1: 500, y1: CAO - LE - CO });
    // Moi doan nam tren cung mot duong mep (khong cat ngang vung giua).
    for (const d of doan) {
      expect(d.x0 === d.x1 || d.y0 === d.y1).toBe(true);
      expect(d.cx).toBeGreaterThanOrEqual(LE);
      expect(d.cx).toBeLessThanOrEqual(RONG - LE - CO);
      expect(d.cy).toBeGreaterThanOrEqual(LE);
      expect(d.cy).toBeLessThanOrEqual(CAO - LE - CO);
    }
  });

  it("tu den trung nhau thi khong co doan nao", () => {
    expect(duongDi(GOC, GOC, RONG, CAO, CO, LE, NUA)).toEqual([]);
  });

  it("thoi gian toan chuyen = max(900, tong dai / 0.16), chia theo do dai", () => {
    const doan = duongDi({ x: 100, y: LE }, { x: 500, y: LE }, RONG, CAO, CO, LE, NUA);
    expect(doan[0]?.thoiGian).toBe(400 / 0.16);
    const ngan = duongDi({ x: 100, y: LE }, { x: 120, y: LE }, RONG, CAO, CO, LE, NUA);
    expect(ngan[0]?.thoiGian).toBe(900);
  });
});

describe("bezier, ease, thoiGianDi", () => {
  it("bezier qua hai dau, giua la trung binh co trong so", () => {
    expect(bezier(0, 50, 100, 0)).toBe(0);
    expect(bezier(0, 50, 100, 1)).toBe(100);
    expect(bezier(0, 50, 100, 0.5)).toBe(50);
    expect(bezier(0, 100, 0, 0.5)).toBe(50);
  });

  it("ease qua (0,0), (0.5,0.5), (1,1)", () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
  });

  it("thoiGianDi: doan ngan toi thieu 900ms, doan dai theo toc do 160px/s", () => {
    expect(thoiGianDi(20)).toBe(900);
    expect(thoiGianDi(160)).toBe(1000);
    expect(thoiGianDi(1600)).toBe(10000);
  });
});

describe("tinhBanking", () => {
  it("dung yen thi khong nghieng, khong co gian", () => {
    expect(tinhBanking(0, 0)).toEqual({ goc: 0, tiLeX: 1, tiLeY: 1 });
  });

  it("di ngang: nghieng theo vx, gian ngang", () => {
    const b = tinhBanking(160, 0);
    expect(b.goc).toBeCloseTo(4.8, 5);
    expect(b.tiLeX).toBeGreaterThan(1);
    expect(b.tiLeY).toBeLessThan(1);
  });

  it("di doc: khong nghieng ngang, gian doc", () => {
    const b = tinhBanking(0, 160);
    expect(b.goc).toBe(0);
    expect(b.tiLeY).toBeGreaterThan(1);
    expect(b.tiLeX).toBeLessThan(1);
  });

  it("goc kep toi da +-13 do, co gian kep toi da 0.13", () => {
    const b = tinhBanking(10000, 0);
    expect(b.goc).toBe(13);
    expect(b.tiLeX).toBeCloseTo(1.13, 5);
    expect(tinhBanking(-10000, 0).goc).toBe(-13);
  });
});

describe("heSoTho va cau dao choi", () => {
  it("tho trong khoang +-1,5%", () => {
    for (let t = 0; t < 10000; t += 137) {
      const s = heSoTho(t);
      expect(s).toBeGreaterThanOrEqual(0.985);
      expect(s).toBeLessThanOrEqual(1.015);
    }
  });

  it("co dung 3 cau dao choi cua demo v4, khong nhac ten ai", () => {
    expect(CAU_DAO_CHOI).toHaveLength(3);
    expect(CAU_DAO_CHOI).toContain("Chíp đang dạo chơi đây~");
    for (const cau of CAU_DAO_CHOI) {
      expect(cau).not.toContain("Linh");
      expect(cau).not.toContain("Mạnh");
    }
  });
});

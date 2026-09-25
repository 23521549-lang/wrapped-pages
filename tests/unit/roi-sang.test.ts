import { describe, expect, it } from "vitest";
import { DOI_BIA_MS, DON_TRE_MS, ROI_SANG_MS, khungBiaCu, khungVetSang, kenBiaCu, kenVetSang } from "@/lib/roi-sang";

/*
 * Ngan sach muot cua hieu ung doi bia: chi duoc dong vao transform va opacity, khong mot thuoc tinh nao lam trinh
 * duyet dan lai trang. Tep nay la cong giu dieu do, va giu ca hai con so chu du an da chot: mot giay cho mot lan doi,
 * muoi giay giua hai lan.
 */

/** Moi ten thuoc tinh xuat hien trong mot day khung hinh, tru offset (offset la moc thoi gian, khong phai thuoc tinh). */
function thuocTinh(khung: Keyframe[]): string[] {
  const ten = new Set<string>();
  for (const k of khung) for (const t of Object.keys(k)) if (t !== "offset") ten.add(t);
  return [...ten].sort();
}

describe("nhip cua hieu ung roi sang", () => {
  it("mot lan doi keo dai khoang mot giay, hai lan cach nhau muoi giay", () => {
    expect(ROI_SANG_MS).toBe(1020);
    expect(DOI_BIA_MS).toBe(10_000);
    expect(DON_TRE_MS).toBeGreaterThan(0);
  });

  it("ca hai day khung hinh CHI dong vao transform va opacity", () => {
    expect(thuocTinh(khungVetSang())).toEqual(["opacity", "transform"]);
    expect(thuocTinh(khungBiaCu())).toEqual(["opacity"]);
  });

  it("khong day nao cham vao mot thuoc tinh lam dan lai trang", () => {
    const cam = ["width", "height", "top", "left", "right", "bottom", "margin", "padding", "font-size", "inset"];
    for (const khung of [khungVetSang(), khungBiaCu()]) {
      for (const t of thuocTinh(khung)) expect(cam, `khung hinh dung ${t}`).not.toContain(t);
    }
  });

  it("vet sang di tu ngoai mep trai toi ngoai mep phai, va mo o ca hai dau", () => {
    const k = khungVetSang();
    expect(k[0].offset).toBe(0);
    expect(k[k.length - 1].offset).toBe(1);
    expect(k[0].opacity).toBe(0);
    expect(k[k.length - 1].opacity).toBe(0);
    const x = (v: Keyframe) => Number(/translate3d\((-?[0-9.]+)%/.exec(String(v.transform))?.[1]);
    expect(x(k[0])).toBeLessThan(-100);
    expect(x(k[k.length - 1])).toBeGreaterThan(100);
    // Di mot chieu, khong bao gio lui lai.
    for (let i = 1; i < k.length; i++) expect(x(k[i])).toBeGreaterThan(x(k[i - 1]));
  });

  it("bia cu bat dau ro het va ket thuc mo han: no la thu duy nhat bien di", () => {
    const k = khungBiaCu();
    expect(k[0].opacity).toBe(1);
    expect(k[k.length - 1].opacity).toBe(0);
    // Chi mo dan, khong bao gio ro lai.
    for (let i = 1; i < k.length; i++) expect(Number(k[i].opacity)).toBeLessThanOrEqual(Number(k[i - 1].opacity));
  });

  it("bia cu mo di SAU khi vet sang da vao khung, khong mo ngay tu khung hinh dau", () => {
    const vet = khungVetSang();
    const cu = khungBiaCu();
    const batDauMo = cu.find((k) => Number(k.opacity) < 1)?.offset ?? 0;
    const vetVao = vet.find((k) => Number(k.opacity) === 1)?.offset ?? 1;
    expect(Number(batDauMo)).toBeGreaterThan(Number(vetVao));
  });

  it("ca hai ken cung thoi luong va deu giu mat cuoi cho buoc don", () => {
    for (const ken of [kenVetSang(), kenBiaCu()]) {
      expect(ken.duration).toBe(ROI_SANG_MS);
      expect(ken.fill).toBe("forwards");
      expect(typeof ken.easing).toBe("string");
    }
  });
});

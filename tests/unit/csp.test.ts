import { describe, it, expect } from "vitest";
import { chuoiCsp, nonceCuaTaiLieu, type NoiCoNonce } from "@/lib/csp";
import { YT_HOST } from "@/components/music/youtubeApi";

const NONCE = "abc123==";

/** Tach chuoi CSP thanh map ten chi thi -> danh sach nguon, de kiem tung chi thi mot cach chac chan. */
function chiThi(csp: string): Record<string, string[]> {
  const ra: Record<string, string[]> = {};
  for (const phan of csp.split(";")) {
    const tu = phan.trim().split(/\s+/).filter((t) => t !== "");
    if (tu.length > 0) ra[tu[0]] = tu.slice(1);
  }
  return ra;
}

describe("chuoiCsp", () => {
  it("chuoi hop le: khong xuong dong, khong hai dau cham phay lien nhau, khong thua khoang trang", () => {
    for (const dev of [false, true]) {
      const csp = chuoiCsp(NONCE, dev);
      expect(csp, `dev=${dev}`).not.toMatch(/[\r\n\t]/);
      expect(csp, `dev=${dev}`).not.toMatch(/;\s*;/);
      expect(csp, `dev=${dev}`).not.toMatch(/\s{2,}/);
      expect(csp, `dev=${dev}`).not.toMatch(/^\s|\s$/);
      expect(csp.endsWith(";"), `dev=${dev}`).toBe(false);
    }
  });

  it("co du moi chi thi, khong thieu khong thua", () => {
    expect(Object.keys(chiThi(chuoiCsp(NONCE, false)))).toEqual([
      "default-src",
      "script-src",
      "style-src",
      "style-src-attr",
      "img-src",
      "media-src",
      "worker-src",
      "font-src",
      "connect-src",
      "frame-src",
      "object-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
      "upgrade-insecure-requests",
    ]);
  });

  it("default-src chi la 'self'", () => {
    expect(chiThi(chuoiCsp(NONCE, false))["default-src"]).toEqual(["'self'"]);
  });

  it("script-src: nonce cua request, 'strict-dynamic' de YouTube IFrame API tu chen duoc, khong mo mien youtube.com", () => {
    const d = chiThi(chuoiCsp(NONCE, false))["script-src"];
    expect(d).toEqual(["'self'", `'nonce-${NONCE}'`, "'strict-dynamic'"]);
    expect(chuoiCsp(NONCE, false)).not.toContain("www.youtube.com");
    expect(chuoiCsp(NONCE, true)).not.toContain("www.youtube.com");
  });

  it("'unsafe-eval' chi co luc phat trien, khong bao gio co o ban phat hanh", () => {
    expect(chiThi(chuoiCsp(NONCE, true))["script-src"]).toEqual([
      "'self'",
      `'nonce-${NONCE}'`,
      "'strict-dynamic'",
      "'unsafe-eval'",
    ]);
    expect(chuoiCsp(NONCE, false)).not.toContain("'unsafe-eval'");
  });

  it("khong bao gio co 'unsafe-inline' o script-src, ke ca luc phat trien", () => {
    for (const dev of [false, true]) {
      expect(chiThi(chuoiCsp(NONCE, dev))["script-src"], `dev=${dev}`).not.toContain("'unsafe-inline'");
    }
  });

  it("style-src mang nonce o ban phat hanh; rieng THUOC TINH style duoc mo qua style-src-attr vi nonce khong cuu duoc no", () => {
    const d = chiThi(chuoiCsp(NONCE, false));
    expect(d["style-src"]).toEqual(["'self'", `'nonce-${NONCE}'`]);
    expect(d["style-src"]).not.toContain("'unsafe-inline'");
    expect(d["style-src-attr"]).toEqual(["'unsafe-inline'"]);
  });

  it("style-src luc phat trien la 'unsafe-inline' KHONG nonce (co nonce thi trinh duyet bo qua 'unsafe-inline')", () => {
    const d = chiThi(chuoiCsp(NONCE, true));
    expect(d["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(d["style-src-attr"]).toEqual(["'unsafe-inline'"]);
  });

  it("img-src mo data: cho bia du phong ve bang SVG noi tuyen va blob: cho anh xem thu", () => {
    expect(chiThi(chuoiCsp(NONCE, false))["img-src"]).toEqual(["'self'", "data:", "blob:"]);
  });

  it("media-src co blob:, vi ban ghi am nghe thu truoc khi chen phat tu mot blob: URL", () => {
    expect(chiThi(chuoiCsp(NONCE, false))["media-src"]).toEqual(["'self'", "blob:"]);
  });

  it("worker-src chi 'self' va blob:: bo doc anh iPhone (heic-to) chay trong mot Worker tao tu blob:", () => {
    for (const dev of [false, true]) {
      expect(chiThi(chuoiCsp(NONCE, dev))["worker-src"], `dev=${dev}`).toEqual(["'self'", "blob:"]);
    }
  });

  it("font-src chi 'self': next/font/google tai phong ve luc dung nen khong mo mien cua Google", () => {
    const csp = chuoiCsp(NONCE, false);
    expect(chiThi(csp)["font-src"]).toEqual(["'self'"]);
    expect(csp).not.toContain("fonts.googleapis.com");
    expect(csp).not.toContain("fonts.gstatic.com");
  });

  it("connect-src co blob:: bo doc anh iPhone (heic-to) doc tep qua blob: URL trong Worker cua no", () => {
    expect(chiThi(chuoiCsp(NONCE, false))["connect-src"]).toEqual(["'self'", "blob:"]);
  });

  it("frame-src dung ban khong luu dau chan cua YouTube, ghi du ten mien", () => {
    expect(chiThi(chuoiCsp(NONCE, false))["frame-src"]).toEqual(["https://www.youtube-nocookie.com"]);
  });

  it("frame-src mo dung mien ma trinh phat nhac nen that su nhung (YT_HOST), o ca hai che do", () => {
    // Mien nay nam hai noi: csp.ts va youtubeApi.ts. Doi mot noi ma quen noi kia thi e2e van xanh (YouTube bi gia
    // lap offline, khung that khong bao gio nap) con nhac nen tat im o ban phat hanh; chi o day hai noi gap nhau.
    for (const dev of [false, true]) {
      expect(chiThi(chuoiCsp(NONCE, dev))["frame-src"], `dev=${dev}`).toContain(new URL(YT_HOST).origin);
    }
  });

  it("khoa cac huong tan cong con lai", () => {
    const d = chiThi(chuoiCsp(NONCE, false));
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["upgrade-insecure-requests"]).toEqual([]);
  });

  it("moi nonce khac nhau cho ra chuoi khac nhau, nonce khong bi ke o cho nao khac", () => {
    const csp = chuoiCsp("XYZ", false);
    expect([...csp.matchAll(/'nonce-XYZ'/g)]).toHaveLength(2);
    expect(csp).not.toBe(chuoiCsp("ABC", false));
    // Luc phat trien nonce chi con o script-src (style-src dung 'unsafe-inline').
    expect([...chuoiCsp("XYZ", true).matchAll(/'nonce-XYZ'/g)]).toHaveLength(1);
  });
});

/** Tai lieu gia: tra ve phan tu da dat cho bo chon "script[nonce]", giong DOM that. */
function taiLieuGia(script: { nonce?: string } | null): NoiCoNonce {
  return { querySelector: (chon) => (chon === "script[nonce]" ? script : null) };
}

describe("nonceCuaTaiLieu", () => {
  it("doc nonce tu thuoc tinh IDL .nonce cua the script dau tien", () => {
    expect(nonceCuaTaiLieu(taiLieuGia({ nonce: "abc123==" }))).toBe("abc123==");
  });

  it("khong co the script nao mang nonce thi tra undefined", () => {
    expect(nonceCuaTaiLieu(taiLieuGia(null))).toBeUndefined();
  });

  it("trinh duyet giau gia tri (chuoi rong) cung coi nhu khong co, khong tra ve chuoi rong", () => {
    expect(nonceCuaTaiLieu(taiLieuGia({ nonce: "" }))).toBeUndefined();
    expect(nonceCuaTaiLieu(taiLieuGia({}))).toBeUndefined();
  });
});

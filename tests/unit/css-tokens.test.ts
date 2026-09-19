import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";
import { COVERS, type CoverKey } from "@/lib/book";
import { boComment } from "../helpers/bang-token";

/** Moi file trong src co duoi cho truoc, duong dan dung "/" de doc duoc tren moi he dieu hanh. */
function files(exts: string[]): string[] {
  return (readdirSync("src", { recursive: true }) as string[])
    .map((p) => `src/${p.split(sep).join("/")}`)
    .filter((p) => exts.some((e) => p.endsWith(e)));
}

const MAU_THANG = /oklch[(]|rgba?[(]|hsla?[(]|#[0-9a-f]{3,8}(?![0-9a-z-])/i;
const MAU_THANG_TSX = /oklch[(]|rgba?[(]|hsla?[(]|["'`]#[0-9a-f]{3,8}["'`]/i;
const FONT_CSS = /font-family:[ ]*(?![ ]|var[(]|inherit)/;
const FONT_TSX = /fontFamily:[ ]*["'`](?!var[(])/;
const EM_DASH = String.fromCodePoint(0x2014);

/** Khoa bia sang tien to token nen cua no trong tokens.css. */
const TIEN_TO_BIA: Record<CoverKey, string> = {
  "nui-xa": "nui", "khom-truc": "truc", "trang-nuoc": "trang", "chim-bay": "chim", "hoa-dao": "dao",
  "doi-chim": "se", "thuyen-trang": "thuyen", "cau-go": "cau", "doi-thong": "thong", "meo-mai": "meo",
};

/** Cac quy tac phang cua mot tep CSS (bo chu thich): danh sach bo chon va than khai bao. */
function quyTac(css: string): { chon: string[]; than: string }[] {
  const out: { chon: string[]; than: string }[] = [];
  for (const m of boComment(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ chon: m[1].split(",").map((s) => s.trim()).filter(Boolean), than: m[2] });
  }
  return out;
}

/** Gia tri oklch(L% C H) cua mot token trong tokens.css. */
function oklchCua(css: string, ten: string): { l: number; c: number; h: number } {
  const m = new RegExp(String.raw`${ten}:\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)`).exec(css);
  if (m === null) throw new Error(`thieu token ${ten}`);
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) };
}

describe("mau va chu chi di qua token (Global Constraints)", () => {
  it("tokens.css co du token cua giao dien sach", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    const can = [
      "--color-giay", "--radius-giay", "--shadow-rest", "--shadow-lift", "--z-raised", "--z-sticky",
      ...Object.values(TIEN_TO_BIA).flatMap((b) => [`--bia-${b}-tren`, `--bia-${b}-duoi`]),
    ];
    for (const name of can) expect(css, name).toContain(`${name}:`);
  });

  it("nen moi bia nhat trong mot dai hep: muc o moi muc dam van nhat, khong bia nao thanh mang dam", () => {
    const css = boComment(readFileSync("src/styles/tokens.css", "utf8"));
    for (const b of Object.values(TIEN_TO_BIA)) {
      const tren = oklchCua(css, `--bia-${b}-tren`);
      const duoi = oklchCua(css, `--bia-${b}-duoi`);
      expect(tren.l, `--bia-${b}-tren`).toBeGreaterThanOrEqual(96.5);
      expect(tren.l, `--bia-${b}-tren`).toBeLessThanOrEqual(97.5);
      expect(tren.c, `--bia-${b}-tren`).toBeLessThanOrEqual(0.034);
      expect(duoi.l, `--bia-${b}-duoi`).toBeGreaterThanOrEqual(92.5);
      expect(duoi.l, `--bia-${b}-duoi`).toBeLessThanOrEqual(94);
      expect(duoi.c, `--bia-${b}-duoi`).toBeLessThanOrEqual(0.034);
    }
  });

  it("moi bia dung mot quy tac trong app.css, nen va gay sach deu doc tu hai bien cua no", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    const rules = quyTac(readFileSync("src/styles/app.css", "utf8"));
    for (const c of COVERS) {
      const b = TIEN_TO_BIA[c];
      const rieng = rules.filter((r) => r.chon.length === 1 && r.chon[0] === `.bia--${c}`);
      expect(rieng, `.bia--${c}`).toHaveLength(1);
      expect(rieng[0].than).toContain(`--bia-tren: var(--bia-${b}-tren)`);
      expect(rieng[0].than).toContain(`--bia-duoi: var(--bia-${b}-duoi)`);
      expect(tokens).toContain(`--bia-${b}-tren:`);
      expect(tokens).toContain(`--bia-${b}-duoi:`);
    }
    const nen = rules.filter((r) => COVERS.every((c) => r.chon.includes(`.bia--${c}`)));
    expect(nen).toHaveLength(1);
    expect(nen[0].than).toContain("background: linear-gradient(var(--bia-tren), var(--bia-duoi))");
    expect(rules.flatMap((r) => r.chon).filter((s) => /\.cuon__bia\.bia--/.test(s))).toEqual([]);
    const cuon = rules.filter((r) => r.chon.includes(".cuon__bia") && r.than.includes("--gay:"));
    expect(cuon).toHaveLength(1);
    expect(cuon[0].than).toContain("--gay: color-mix(in oklch, var(--bia-duoi) var(--gay-sach-pha), var(--color-ink))");
  });

  it("file CSS ngoai tokens.css khong viet mau thang, font-family chi qua token", () => {
    const loi = files([".css"])
      .filter((f) => !f.endsWith("/tokens.css"))
      .flatMap((f) => {
        const css = readFileSync(f, "utf8");
        const out: string[] = [];
        if (MAU_THANG.test(css)) out.push(`${f}: mau viet thang`);
        if (FONT_CSS.test(css)) out.push(`${f}: font-family khong qua token`);
        return out;
      });
    expect(loi).toEqual([]);
  });

  it("style trong TSX khong viet mau thang, fontFamily chi qua token", () => {
    const loi = files([".tsx"]).filter((f) => {
      const src = readFileSync(f, "utf8");
      return MAU_THANG_TSX.test(src) || FONT_TSX.test(src);
    });
    expect(loi).toEqual([]);
  });

  it("khong co ky tu em-dash nao trong src", () => {
    expect(files([".ts", ".tsx", ".css"]).filter((f) => readFileSync(f, "utf8").includes(EM_DASH))).toEqual([]);
  });

  it("giay.css khong viet cung kich thuoc to, chi dung token --giay-*", () => {
    const css = readFileSync("src/styles/giay.css", "utf8");
    expect(css).not.toMatch(/(?:^|[^0-9])(?:360|540|304|460)px/);
  });

  it("luat giam chuyen dong chi rut ngan mo va doi mau, khong tao transition cho bo cuc hay visibility", () => {
    const css = readFileSync("src/styles/globals.css", "utf8");
    const bat = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(bat).toBeGreaterThan(-1);
    const khoi = css.slice(bat, css.indexOf("}", bat) + 1);
    // transition-property mac dinh la `all`: chi ep transition-duration thi moi thay doi width, height, visibility cua
    // moi phan tu deu bi animate 150ms, nghia la CO chuyen dong dung luc nguoi dung xin tat.
    expect(khoi).toContain("transition-duration:150ms !important;");
    expect(khoi).toContain("transition-property: opacity, color, background-color, border-color, box-shadow, outline-color !important;");
  });

  it("giay-noi-dung xuong dong nhu CSS TipTap tu chen cho .ProseMirror", () => {
    const css = readFileSync("src/styles/giay.css", "utf8");
    for (const d of ["white-space: break-spaces;", "font-variant-ligatures: none;", 'font-feature-settings: "liga" 0;']) {
      expect(css).toContain(d);
    }
  });
});

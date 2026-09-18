import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// He tep khong co hard link (FAT32/exFAT tren USB) bao loi link bang ma khac nhau tuy he dieu hanh; tren
// Windows la EISDIR. Gia lap dieu do de kiem nhanh lui ve rename cua ghiTepNguyenTu.
const maLoiLink = vi.hoisted(() => ({ ma: "EISDIR" }));
vi.mock("node:fs/promises", async (goc) => {
  const that = await goc<typeof import("node:fs/promises")>();
  return {
    ...that,
    link: async () => {
      throw Object.assign(new Error("link khong duoc"), { code: maLoiLink.ma });
    },
  };
});

const { ghiTepNguyenTu } = await import("@/server/backup/sao-luu");

describe("ghiTepNguyenTu tren he tep khong co hard link", () => {
  it("link hong voi ma bat ky khac EEXIST thi lui ve rename, van khong ghi de va khong de lai tep tam", async () => {
    const thuMuc = await mkdtemp(path.join(tmpdir(), "mqce-sl-usb-"));
    try {
      for (const ma of ["EISDIR", "EPERM", "UNKNOWN"]) {
        maLoiLink.ma = ma;
        const p = path.join(thuMuc, `${ma}.json`);
        await ghiTepNguyenTu(p, ma);
        expect(await readFile(p, "utf8")).toBe(ma);
        await expect(ghiTepNguyenTu(p, "khac")).rejects.toThrow(/không ghi đè/);
        expect(await readFile(p, "utf8")).toBe(ma);
      }
      expect((await readdir(thuMuc)).sort()).toEqual(["EISDIR.json", "EPERM.json", "UNKNOWN.json"]);
    } finally {
      await rm(thuMuc, { recursive: true, force: true });
    }
  });
});

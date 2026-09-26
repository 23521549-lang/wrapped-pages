import { describe, expect, it, vi } from "vitest";
import { duongOembed, taoBoTenBai, type LayVe } from "@/server/media/ten-youtube";

/*
 * Ten bai cua nhac trong ngay (spec bo sung B4 ban hai): lay tu oEmbed o may chu, co bo nho dem, va khong bao gio lam
 * trang hong - loi nao cung chi la "khong co ten".
 */

const A = "dQw4w9WgXcQ";
const B = "5qap5aO4i9A";

const traVe = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

describe("duongOembed", () => {
  it("hoi dung oEmbed cua YouTube voi link watch da ma hoa", () => {
    expect(duongOembed(A)).toBe(`https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${A}`);
  });
});

describe("taoBoTenBai", () => {
  it("tra ten va kenh; khong co kenh thi kenh null; cat khoang trang", async () => {
    const layVe = vi.fn<LayVe>((url) => traVe(url.includes(A) ? { title: "  Never Gonna Give You Up ", author_name: "Rick Astley" } : { title: "lofi" }));
    const ten = await taoBoTenBai(layVe)([A, B]);
    expect(ten).toEqual({ [A]: { ten: "Never Gonna Give You Up", kenh: "Rick Astley" }, [B]: { ten: "lofi", kenh: null } });
  });

  it("ma lap chi hoi mot lan; ma sai dang khong bao gio duoc ghep vao duong dan", async () => {
    const layVe = vi.fn<LayVe>(() => traVe({ title: "x" }));
    const ten = await taoBoTenBai(layVe)([A, A, "../../evil", "khong-phai-ma"]);
    expect(layVe).toHaveBeenCalledTimes(1);
    expect(Object.keys(ten)).toEqual([A]);
  });

  it("loi mang, tra ve khong ok, JSON hong hay thieu title: khong co ten, khong nem loi", async () => {
    const cacKieu: LayVe[] = [
      () => Promise.reject(new Error("mat mang")),
      () => traVe({ title: "x" }, false),
      () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError("hong")) }),
      () => traVe({ author_name: "ai do" }),
      () => traVe({ title: "   " }),
      () => traVe(null),
    ];
    for (const layVe of cacKieu) expect(await taoBoTenBai(layVe)([A])).toEqual({});
  });

  it("hoi song song va dat han cho moi lan hoi", async () => {
    const tinHieu: AbortSignal[] = [];
    let dangHoi = 0;
    let caoNhat = 0;
    const layVe = vi.fn<LayVe>(async (_url, init) => {
      tinHieu.push(init.signal);
      expect(init.cache).toBe("no-store");
      dangHoi += 1;
      caoNhat = Math.max(caoNhat, dangHoi);
      await Promise.resolve();
      dangHoi -= 1;
      return traVe({ title: "x" });
    });
    await taoBoTenBai(layVe)([A, B]);
    expect(caoNhat).toBe(2);
    expect(tinHieu.every((s) => s instanceof AbortSignal)).toBe(true);
  });

  it("co ten thi giu mot tuan; hoi hong thi chi giu muoi phut roi hoi lai", async () => {
    let now = 0;
    let lanHoiB = 0;
    const layVe = vi.fn<LayVe>((url) => {
      if (url.includes(A)) return traVe({ title: "A" });
      lanHoiB += 1;
      return lanHoiB === 1 ? traVe({}, false) : traVe({ title: "B" });
    });
    const ten = taoBoTenBai(layVe, () => now);
    expect(await ten([A, B])).toEqual({ [A]: { ten: "A", kenh: null } });
    now = 9 * 60 * 1000;
    await ten([A, B]);
    expect(layVe).toHaveBeenCalledTimes(2);
    now = 10 * 60 * 1000;
    expect(await ten([A, B])).toEqual({ [A]: { ten: "A", kenh: null }, [B]: { ten: "B", kenh: null } });
    expect(layVe).toHaveBeenCalledTimes(3);
    now = 7 * 24 * 60 * 60 * 1000;
    await ten([A]);
    expect(layVe).toHaveBeenCalledTimes(4);
  });

  it("ten dai qua 200 ky tu thi cat", async () => {
    const ten = await taoBoTenBai(() => traVe({ title: "a".repeat(500) }))([A]);
    expect(ten[A].ten).toHaveLength(200);
  });

  it("bo nho dem khong phinh qua 500 ma: ma cu nhat bi bo truoc", async () => {
    const layVe = vi.fn<LayVe>(() => traVe({ title: "x" }));
    const ten = taoBoTenBai(layVe);
    const ma = (i: number) => `a${String(i).padStart(10, "0")}`;
    for (let i = 0; i < 501; i++) await ten([ma(i)]);
    expect(layVe).toHaveBeenCalledTimes(501);
    await ten([ma(500)]);
    expect(layVe).toHaveBeenCalledTimes(501);
    await ten([ma(0)]);
    expect(layVe).toHaveBeenCalledTimes(502);
  });
});

import { describe, expect, it } from "vitest";
import { congMoSach } from "@/lib/cong-mo-sach";

describe("congMoSach", () => {
  it.each<[string, { trang?: unknown; mo?: unknown }, boolean]>([
    ["khong tham so: hien tam bia", {}, true],
    ["chi ?trang: mo thang trang, khong bia", { trang: "2" }, false],
    ["chi ?mo: nghi thuc mo khoa, khong bia", { mo: "niem-phong-1" }, false],
    ["ca ?trang va ?mo: khong bia", { trang: "1", mo: "niem-phong-1" }, false],
    ["?trang rong van la co tham so", { trang: "" }, false],
    ["?trang lap lai (mang)", { trang: ["1", "2"] }, false],
  ])("%s", (_ten, query, mong) => {
    expect(congMoSach(query)).toBe(mong);
  });

  it("chi phu thuoc loi vao: khong con tham so tat nhac (chu du an 26/09: moi cuon deu qua tam bia)", () => {
    expect(congMoSach.length).toBe(1);
  });
});

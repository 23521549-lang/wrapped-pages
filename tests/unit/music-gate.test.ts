import { describe, expect, it } from "vitest";
import { musicGate } from "@/lib/music-gate";

describe("musicGate", () => {
  it.each<[string, boolean, { trang?: unknown; mo?: unknown }, boolean]>([
    ["khong tham so: hien tam bia", false, {}, true],
    ["chi ?trang: mo thang trang, khong bia", false, { trang: "2" }, false],
    ["chi ?mo: nghi thuc mo khoa, khong bia", false, { mo: "niem-phong-1" }, false],
    ["ca ?trang va ?mo: khong bia", false, { trang: "1", mo: "niem-phong-1" }, false],
    ["?trang rong van la co tham so", false, { trang: "" }, false],
    ["?trang lap lai (mang)", false, { trang: ["1", "2"] }, false],
    ["da tat nhac: khong bia", true, {}, false],
    ["da tat nhac kem ?trang: khong bia", true, { trang: "1" }, false],
  ])("%s", (_ten, muted, query, mong) => {
    expect(musicGate(muted, query)).toBe(mong);
  });
});

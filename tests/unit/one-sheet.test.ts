import { describe, expect, it } from "vitest";
import { oneSheetOf } from "@/components/editor/useOneSheet";
import type { Unit } from "@/lib/paginate";
import { CONTENT_HEIGHT } from "@/lib/sheet";

/** n dong cao h px, xep lien nhau tu dinh vung chu. */
function dong(n: number, h: number): Unit[] {
  return Array.from({ length: n }, (_, i) => ({ top: i * h, bottom: (i + 1) * h, pos: i + 1 }));
}

describe("oneSheetOf: trang tra loi vua dung mot to", () => {
  const h = CONTENT_HEIGHT / 20;

  it("chua co dong nao thi vua mot to, cao 0", () => {
    expect(oneSheetOf([])).toEqual({ overflow: false, contentHeight: 0 });
  });

  it("chu cham dung day vung chu van la mot to", () => {
    expect(oneSheetOf(dong(20, h))).toEqual({ overflow: false, contentHeight: CONTENT_HEIGHT });
  });

  it("them mot dong qua day vung chu la tran, chieu cao tinh toi day dong cuoi", () => {
    expect(oneSheetOf(dong(21, h))).toEqual({ overflow: true, contentHeight: 21 * h });
  });
});

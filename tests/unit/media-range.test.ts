import { describe, it, expect } from "vitest";
import { parseRange, type RangeResult } from "@/lib/media/range";

const SIZE = 100;

describe("parseRange", () => {
  it.each<[string, string | null, RangeResult]>([
    ["khong co header thi ca tep", null, { status: 200 }],
    ["header rong thi ca tep", "", { status: 200 }],
    ["tu dau toi het tep", "bytes=0-", { status: 206, start: 0, end: SIZE - 1 }],
    ["mot khoang giua tep", "bytes=10-19", { status: 206, start: 10, end: 19 }],
    ["hau to 5 byte cuoi", "bytes=-5", { status: 206, start: SIZE - 5, end: SIZE - 1 }],
    ["hau to dai hon tep thi ca tep dang 206", "bytes=-500", { status: 206, start: 0, end: SIZE - 1 }],
    ["cuoi vuot tep thi kep ve byte cuoi", "bytes=90-1000", { status: 206, start: 90, end: SIZE - 1 }],
    ["dung mot byte cuoi", "bytes=99-99", { status: 206, start: 99, end: 99 }],
    ["don vi viet hoa va khoang trang hai dau", "  Bytes=0-0 ", { status: 206, start: 0, end: 0 }],
    ["bat dau dung bang kich thuoc thi 416", "bytes=100-", { status: 416 }],
    ["bat dau vuot tep thi 416", "bytes=150-160", { status: 416 }],
    ["hau to 0 byte thi 416", "bytes=-0", { status: 416 }],
    ["nhieu khoang khong ho tro thi ca tep", "bytes=0-1,5-6", { status: 200 }],
    ["cuoi truoc dau la sai cu phap thi ca tep", "bytes=20-10", { status: 200 }],
    ["thieu ca hai dau thi ca tep", "bytes=-", { status: 200 }],
    ["don vi khac thi ca tep", "items=0-10", { status: 200 }],
    ["chu thay so thi ca tep", "bytes=a-b", { status: 200 }],
  ])("%s", (_ten, header, want) => {
    expect(parseRange(header, SIZE)).toEqual(want);
  });

  it("tep rong: khong co header thi 200, moi khoang deu 416", () => {
    expect(parseRange(null, 0)).toEqual({ status: 200 });
    for (const header of ["bytes=0-", "bytes=0-0", "bytes=-5"]) expect(parseRange(header, 0)).toEqual({ status: 416 });
  });
});

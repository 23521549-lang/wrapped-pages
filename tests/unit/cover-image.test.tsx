// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { BookCard } from "@/components/book/BookCard";
import { BookCover } from "@/components/music/BookCover";

/*
 * Bia tu tai len tren DOM that: anh /m/<id> phu len tranh ve trong cung khung; anh hong thi an, tranh ve lo ra,
 * khung khong doi. BookCard la the tren ke va o xem truoc cua form, BookCover la tam bia o cong nhac.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7a2e4c6b-8d0f-4a1c-9e3b-5d7f9b1d3f5a";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const the = (coverMediaId: string | null) => (
  <BookCard title="Chuyện chưa kể" cover="chim-bay" owner="Linh" meta="Linh · hôm qua" href="/sach/b1" coverMediaId={coverMediaId} />
);
const khung = (c: HTMLElement) => c.querySelector(".book__cover.bia--chim-bay") as HTMLElement;
/** Cac phan tu con cua mot khung: ten the kem class, theo thu tu ve. */
const conCua = (el: Element) => [...el.children].map((c) => [c.tagName.toLowerCase(), ...c.classList].join("."));
const anh = (c: HTMLElement) => c.querySelector("img") as HTMLImageElement;

describe("anh bia tu tai len", () => {
  it("khong co bia tu tai len: khung chi co tranh ve va o chu sach", () => {
    const { container } = render(the(null));
    expect(conCua(khung(container))).toEqual(["svg", "span.av.book__owner"]);
  });

  it("co bia: img /m/<id> nam tren tranh ve, duoi o chu sach, alt rong vi ten sach nam ngay canh", () => {
    const { container } = render(the(ID));
    expect(conCua(khung(container))).toEqual(["svg", "img.bia__anh", "span.av.book__owner"]);
    expect([anh(container).getAttribute("src"), anh(container).getAttribute("alt"), anh(container).hidden]).toEqual([`/m/${ID}`, "", false]);
  });

  it("anh hong: img an, tranh ve van o nguyen khung, khong them o nao", () => {
    const { container } = render(the(ID));
    fireEvent.error(anh(container));
    expect(anh(container).hidden).toBe(true);
    expect(conCua(khung(container))).toEqual(["svg", "img.bia__anh", "span.av.book__owner"]);
  });

  it("anh da hong truoc khi React gan su kien (complete ma naturalWidth 0): an ngay khi gan", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    expect(anh(render(the(ID)).container).hidden).toBe(true);
  });

  it("anh da tai xong hoac con dang tai luc gan thi van hien", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1200);
    expect(anh(render(the(ID)).container).hidden).toBe(false);
    cleanup();
    complete.mockReturnValue(false);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    expect(anh(render(the(ID)).container).hidden).toBe(false);
  });

  it("doi sang bia khac sau khi anh cu hong: img moi hien lai; bo bia thi het img", () => {
    const { container, rerender } = render(the(ID));
    fireEvent.error(anh(container));
    rerender(the(ID_2));
    expect([anh(container).getAttribute("src"), anh(container).hidden]).toEqual([`/m/${ID_2}`, false]);
    rerender(the(null));
    expect(container.querySelector("img")).toBeNull();
  });

  it("tam bia o cong nhac cung phu anh len tranh ve", () => {
    const { container } = render(<BookCover title="Chuyện chưa kể" cover="nui-xa" owner="Linh" coverMediaId={ID} />);
    expect(conCua(container.querySelector(".bia.bia-mo__hinh.bia--nui-xa") as HTMLElement)).toEqual(["svg", "img.bia__anh"]);
    expect(anh(container).getAttribute("src")).toBe(`/m/${ID}`);
  });
});

// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RoundList } from "@/components/book/RoundList";
import type { RoundListItem } from "@/server/library/edit-round";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

afterEach(cleanup);

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const NOW = new Date("2026-09-22T05:00:00.000Z");
const LUOT: RoundListItem[] = [
  { id: "l1", ordinal: 1, first: 1, last: 5, publishedAt: new Date("2026-09-18T02:00:00.000Z"), sealed: false },
  { id: "l2", ordinal: 2, first: 6, last: 11, publishedAt: new Date("2026-09-20T02:00:00.000Z"), sealed: true },
  { id: "l3", ordinal: 3, first: 12, last: 12, publishedAt: new Date("2025-12-31T02:00:00.000Z"), sealed: false },
];

describe("RoundList", () => {
  it("moi luot mot dong: so thu tu, khoang trang, ngay dang, noi bang dau cham giua", () => {
    render(<RoundList bookId={SACH} rounds={LUOT} now={NOW} />);
    const muc = screen.getByRole("region", { name: "Nội dung" });
    const dong = within(muc).getAllByRole("listitem");
    expect(dong.map((d) => d.querySelector(".luot__chu")?.textContent)).toEqual([
      "Lượt 1 · trang 1 tới 5 · 18.09", "Lượt 2 · trang 6 tới 11 · 20.09", "Lượt 3 · trang 12 · 31.12.2025",
    ]);
  });

  it("luot sua duoc co nut toi man sua luot, ten doc duoc phan biet tung luot; luot con niem phong chi co dong chu", () => {
    render(<RoundList bookId={SACH} rounds={LUOT} now={NOW} />);
    const nut = screen.getAllByRole("link");
    expect(nut.map((n) => [n.textContent, n.getAttribute("href")])).toEqual([
      ["Sửa lượt này (lượt 1)", `/sach/${SACH}/sua-luot/1`],
      ["Sửa lượt này (lượt 3)", `/sach/${SACH}/sua-luot/3`],
    ]);
    const khoa = document.querySelector(".luot__khoa");
    expect(khoa?.textContent).toBe("Đang niêm phong");
    expect(khoa?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("khong luot nao thi khong ve muc", () => {
    const { container } = render(<RoundList bookId={SACH} rounds={[]} now={NOW} />);
    expect(container.innerHTML).toBe("");
  });
});

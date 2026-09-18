import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookCard, type BookCardProps } from "@/components/book/BookCard";

const chu = (p: Partial<BookCardProps>) =>
  renderToStaticMarkup(createElement(BookCard, {
    title: "Chuyện chưa kể", cover: "nui-xa", owner: "Linh", meta: "Linh · hôm qua", pageCount: 3, ...p,
  })).replace(/<[^>]*>/g, "");

describe("BookCard lockedCount", () => {
  it("co to khoa thi chip dem trang khoa dung sau chip trang moi, truoc chip rieng tu", () => {
    expect(chu({ newCount: 2, lockedCount: 1, isPrivate: true })).toContain("3 trang2 trang mới1 trang khóaRiêng tư");
  });

  it("khong co to khoa thi khong co chip trang khoa", () => {
    expect(chu({ lockedCount: 0 })).not.toContain("trang khóa");
    expect(chu({})).not.toContain("trang khóa");
  });
});

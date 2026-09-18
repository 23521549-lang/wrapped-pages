// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Field } from "@/components/Field";

afterEach(() => {
  cleanup();
});

describe("Field", () => {
  it("o nhap luon mang lop input va cac thuoc tinh cua noi goi; kieu prop khong nhan className", () => {
    render(<Field label="Biệt danh" name="nickname" maxLength={20} required />);
    const o = screen.getByLabelText("Biệt danh");
    expect(o.className).toBe("input");
    expect(o.getAttribute("name")).toBe("nickname");
    expect(o.getAttribute("maxlength")).toBe("20");
    // @ts-expect-error Field tu dat lop .input; className cua noi goi se bi bo qua, nen kieu chan tu dau (tsc kiem).
    render(<Field label="Lời nhắn" className="khac" />);
  });
});

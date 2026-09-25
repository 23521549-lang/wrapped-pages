// @vitest-environment jsdom
import { useCallback } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { docDaDung, KHOA_DUNG, useTamDung } from "@/components/hieu-ung/tam-dung";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    // Ban gia cua bai kiem co the khong co clear: khong sao, moi bai tu dat lai gia tri no can.
  }
});

/** Hai thanh phan roi nhau cung nghe mot lua chon: dung nhu bau troi va bia tu doi cua khung sach lon. */
function Thu({ ten, ghi }: { ten: string; ghi?: (v: boolean) => void }) {
  const khiDoi = useCallback((v: boolean) => ghi?.(v), [ghi]);
  const [dung, datDung] = useTamDung(khiDoi);
  return <button type="button" onClick={() => datDung(!dung)}>{`${ten}:${dung ? "dung" : "chay"}`}</button>;
}

describe("useTamDung", () => {
  it("mot lan bam doi trang thai cua MOI noi dang nghe, va ghi vao localStorage", () => {
    render(<><Thu ten="troi" /><Thu ten="bia" /></>);
    expect(screen.getByText("troi:chay")).toBeTruthy();
    expect(screen.getByText("bia:chay")).toBeTruthy();

    fireEvent.click(screen.getByText("troi:chay"));
    expect(screen.getByText("troi:dung")).toBeTruthy();
    expect(screen.getByText("bia:dung")).toBeTruthy();
    expect(localStorage.getItem(KHOA_DUNG)).toBe("dung");

    fireEvent.click(screen.getByText("bia:dung"));
    expect(screen.getByText("troi:chay")).toBeTruthy();
    expect(screen.getByText("bia:chay")).toBeTruthy();
    expect(localStorage.getItem(KHOA_DUNG)).toBe("chay");
  });

  it("lua chon cu duoc doc lai ngay trong lan commit dau tien", () => {
    localStorage.setItem(KHOA_DUNG, "dung");
    expect(docDaDung()).toBe(true);
    render(<Thu ten="troi" />);
    expect(screen.getByText("troi:dung")).toBeTruthy();
  });

  it("khoa la 'troi-tam-dung': nguoi da chon tam dung tu dot truoc khong mat lua chon", () => {
    expect(KHOA_DUNG).toBe("troi-tam-dung");
  });

  /*
   * khiDoi la duong DUY NHAT de mot noi nghe cham thang vao DOM (vi du bat lop `troi-dung` tren dai troi). No phai
   * chay NGAY trong layout effect doc lua chon da luu, truoc khi trinh duyet ve khung hinh dau: doi toi vong ve lai
   * cua setState la nguoi da tat hieu ung van thay dung mot khung hinh hieu ung CHAY.
   */
  it("khiDoi chay ngay luc doc lua chon da luu, va chay ca cho chinh noi vua bam", () => {
    localStorage.setItem(KHOA_DUNG, "dung");
    const troi: boolean[] = [];
    const bia: boolean[] = [];
    render(<><Thu ten="troi" ghi={(v) => troi.push(v)} /><Thu ten="bia" ghi={(v) => bia.push(v)} /></>);
    expect(troi).toEqual([true]);
    expect(bia).toEqual([true]);

    fireEvent.click(screen.getByText("troi:dung"));
    expect(troi).toEqual([true, false]);
    expect(bia).toEqual([true, false]);
  });

  it("trinh duyet cam luu tru: ca doc lan ghi deu nem loi ma lua chon van doi duoc", () => {
    const nem = () => {
      throw new Error("khong cho luu tru");
    };
    vi.stubGlobal("localStorage", { getItem: nem, setItem: nem });
    expect(docDaDung()).toBe(false);
    render(<Thu ten="troi" />);
    fireEvent.click(screen.getByText("troi:chay"));
    expect(screen.getByText("troi:dung")).toBeTruthy();
  });

  it("roi trang thi khong con nghe: mot noi con lai bam khong lam no bao loi", () => {
    const { unmount } = render(<Thu ten="troi" />);
    render(<Thu ten="bia" />);
    unmount();
    fireEvent.click(screen.getByText("bia:chay"));
    expect(screen.getByText("bia:dung")).toBeTruthy();
    expect(screen.queryByText("troi:dung")).toBeNull();
  });
});

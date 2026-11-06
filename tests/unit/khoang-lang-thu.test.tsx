// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { tongKetThang } from "@/lib/tam-trang/tong-ket";
import { LaThuBay } from "@/components/thu/LaThuBay";
import { ChoThu } from "@/components/thu/ChoThu";
import { TongKetThang, type ThangTongKetHien } from "@/components/tam-trang/TongKetThang";

const { actionGuiThu, actionMoThu, actionThuChuaMo, refresh } = vi.hoisted(() => ({
  actionGuiThu: vi.fn(async () => ({ ok: true })),
  actionMoThu: vi.fn(async () => ({ thu: { thang: "2026-09", noiDung: "x", gio: "hôm nay", minhGui: true } })),
  actionThuChuaMo: vi.fn(async () => null),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/thu", () => ({ actionGuiThu, actionMoThu, actionThuChuaMo }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  actionThuChuaMo.mockClear();
  vi.useRealTimers();
});

/*
 * Khoang Lang tren thu thang (task 6, phan hien thi): la thu bay bien mat va dung poll; cho thu chi con phan cua minh.
 */
describe("Khoang Lang: LaThuBay", () => {
  it("bat co: khong ve la thu du dau co thu chua mo; khong poll actionThuChuaMo", async () => {
    vi.useFakeTimers();
    const { container } = render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} khoangLang />);
    expect(container.querySelector(".thu-bay")).toBeNull();
    expect(container.textContent).not.toContain("Linh");
    await vi.advanceTimersByTimeAsync(25_000);
    expect(actionThuChuaMo).not.toHaveBeenCalled();
  });

  it("tat co (kiem soat duong): co la thu va co poll", async () => {
    vi.useFakeTimers();
    render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(actionThuChuaMo).toHaveBeenCalled();
  });
});

describe("Khoang Lang: ChoThu", () => {
  it("bat co, minh da gui: khong hien noi dung thu doi phuong, chi bao da gui", () => {
    const { container } = render(
      <ChoThu
        thang="2026-09"
        tenThangChu="tháng Chín"
        tenKia="Linh"
        tenMinh="Mạnh"
        tt={{ minhGui: true, kiaGui: true }}
        kia={{ noiDung: "Bí mật tháng Chín", gio: "hôm nay, 09:00" }}
        chuaMo
        mo
        khoangLang
      />,
    );
    expect(container.textContent).not.toContain("Bí mật tháng Chín");
    expect(container.textContent).not.toContain("Linh");
    expect(screen.getByText("Thư của bạn đã gửi.")).toBeTruthy();
  });

  it("bat co, minh chua gui: to giay viet thu van hien, loi chao chung khong neu ten", () => {
    const { container } = render(
      <ChoThu
        thang="2026-09"
        tenThangChu="tháng Chín"
        tenKia="Linh"
        tenMinh="Mạnh"
        tt={{ minhGui: false, kiaGui: true }}
        kia={null}
        chuaMo={false}
        mo={false}
        khoangLang
      />,
    );
    expect(screen.getByText("Gửi người đọc,")).toBeTruthy();
    expect(container.textContent).not.toContain("Linh");
  });
});

describe("Khoang Lang: TongKetThang (phan thu)", () => {
  it("bat co: nhan thu chi bao trang thai cua minh; khoi thu khong lo noi dung doi phuong", () => {
    const tk = tongKetThang({}, "Linh", true);
    const thang: ThangTongKetHien[] = [{
      khoa: "2026-09",
      ten: "Tháng Chín, 2026",
      tenThangChu: "tháng Chín",
      tk,
      thu: {
        tt: { minhGui: true, kiaGui: true },
        kia: { noiDung: "Bí mật tháng Chín", gio: "hôm nay, 09:00" },
        chuaMo: true,
      },
    }];
    const { container } = render(
      <TongKetThang
        thang={thang}
        nay={{ ten: "Tháng Mười", mo: "1.11", noiBat: null }}
        tenKia="Linh"
        tenMinh="Mạnh"
        khoangLang
      />,
    );
    expect(container.querySelector(".thg__tt")?.textContent).toBe("Đã gửi");
    expect(container.textContent).not.toContain("Bí mật tháng Chín");
    expect(container.textContent).not.toContain("Linh");
  });
});

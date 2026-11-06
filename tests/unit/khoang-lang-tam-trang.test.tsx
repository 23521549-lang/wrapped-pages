// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { gomLich, luoiThang, type DongLich, type NgayLich } from "@/lib/tam-trang/lich";
import { tongKetThang } from "@/lib/tam-trang/tong-ket";
import { LichHoa } from "@/components/tam-trang/LichHoa";
import { ThaTamTrang } from "@/components/tam-trang/ThaTamTrang";
import { TongKetThang, type ThangTongKetHien } from "@/components/tam-trang/TongKetThang";

const { actionSetMood, actionWithdrawMood, actionMoThu, refresh } = vi.hoisted(() => ({
  actionSetMood: vi.fn(async () => ({ ok: true })),
  actionWithdrawMood: vi.fn(async () => ({ ok: true })),
  actionMoThu: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/mood", () => ({ actionSetMood, actionWithdrawMood }));
vi.mock("@/app/actions/thu", () => ({ actionMoThu }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  actionSetMood.mockClear();
  actionWithdrawMood.mockClear();
  actionMoThu.mockClear();
});

/*
 * Khoang Lang tren tam trang (task 5, phan hien thi): bat co thi LichHoa chi mot hang cua minh, ThaTamTrang khong
 * neu ten doi phuong, TongKetThang chi muc cua minh.
 */
const THANG = { y: 2026, m: 9 };
const NGAY: Record<number, NgayLich> = {
  22: {
    kia: { weather: "mua-phun", gio: "21:40", note: "Nhớ cậu một chút thôi.", xoay: -6 },
    minh: { weather: "nang-am", gio: "08:15", note: null, xoay: 5 },
  },
  21: { kia: null, minh: { weather: "giong", gio: "23:30", note: null, xoay: 0 } },
};

describe("Khoang Lang: LichHoa", () => {
  it("bat co: khong con ten doi phuong, khong con note doi phuong; ngay cua minh van du", () => {
    const { container } = render(
      <LichHoa
        thang={THANG}
        tuan={luoiThang(THANG, 22)}
        ngay={NGAY}
        homNay={22}
        chonDau={22}
        now={new Date("2026-09-22T15:00:00.000Z")}
        tenKia="Linh"
        tenMinh="Mạnh"
        truocHref="/tam-trang?thang=2026-08"
        sauHref={null}
        khoangLang
      />,
    );
    expect(container.querySelector(".thang__tong")?.textContent).toBe("Mạnh ép 2 bông");
    expect(container.querySelector(".lich__chu")?.textContent).not.toContain("Linh");
    expect(container.textContent).not.toContain("Linh");
    expect(container.textContent).not.toContain("Nhớ cậu một chút thôi.");
    const nay = screen.getByRole("button", { name: "22 tháng 9. Mạnh: Nắng ấm. Hôm nay" });
    expect(nay.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Khoang Lang: ThaTamTrang", () => {
  it("bat co: cau goi y khong neu ten doi phuong", () => {
    render(
      <ThaTamTrang
        dau={<div><h1>Kệ sách</h1></div>}
        nutPhu={<span className="btn btn--quiet">Sách mới</span>}
        dangGiu={null}
        minh={null}
        tenKia="Linh"
        khoangLang
      />,
    );
    expect(screen.getByText("Không bắt buộc. Người đọc sẽ thấy dưới bầu trời.")).toBeTruthy();
    expect(screen.queryByText(/Linh/)).toBeNull();
  });
});

describe("Khoang Lang: TongKetThang", () => {
  it("bat co: chi con muc cua minh, cau danh gia khong neu ten doi phuong", () => {
    const rows: DongLich[] = [
      { id: "1", accountId: "seat2", weather: "nang-am", note: null, setAt: new Date("2026-09-22T02:00:00.000Z"), ngay: "2026-09-22" },
    ];
    const tk = tongKetThang(gomLich(rows, "seat2"), "Linh", true);
    const thang: ThangTongKetHien[] = [{
      khoa: "2026-09",
      ten: "Tháng Chín, 2026",
      tenThangChu: "tháng Chín",
      tk,
      thu: { tt: { minhGui: false, kiaGui: false }, kia: null, chuaMo: false },
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
    expect(container.querySelector(".thg__chu")?.textContent).not.toContain("Linh");
    const nguoi = container.querySelectorAll(".thg__nguoi");
    expect(nguoi).toHaveLength(1);
    expect(nguoi[0].querySelector("h4")?.textContent).toContain("Bạn");
  });
});

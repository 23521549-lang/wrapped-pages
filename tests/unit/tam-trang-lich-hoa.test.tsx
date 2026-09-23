// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LichHoa } from "@/components/tam-trang/LichHoa";
import { luoiThang, type NgayLich } from "@/lib/tam-trang/lich";

afterEach(cleanup);

const THANG = { y: 2026, m: 9 };
const NGAY: Record<number, NgayLich> = {
  22: {
    kia: { weather: "mua-phun", gio: "21:40", note: "Nhớ cậu một chút thôi.", xoay: -6 },
    minh: { weather: "nang-am", gio: "08:15", note: null, xoay: 5 },
  },
  21: { kia: null, minh: { weather: "giong", gio: "23:30", note: null, xoay: 0 } },
};

const ve = (sua: { homNay?: number | null; chonDau?: number; sauHref?: string | null } = {}) => {
  const homNay = sua.homNay === undefined ? 22 : sua.homNay;
  return render(
    <LichHoa
      thang={THANG}
      tuan={luoiThang(THANG, homNay)}
      ngay={NGAY}
      homNay={homNay}
      chonDau={sua.chonDau ?? 22}
      now={new Date("2026-09-22T15:00:00.000Z")}
      tenKia="Linh"
      tenMinh="Mạnh"
      truocHref="/tam-trang?thang=2026-08"
      sauHref={sua.sauHref === undefined ? null : sua.sauHref}
    />,
  );
};

describe("LichHoa: thang va chuyen thang", () => {
  it("tieu de thang, thang truoc la lien ket, thang nay thi Thang sau tat, dem so bong moi nguoi", () => {
    const { container } = ve();
    expect(screen.getByRole("heading", { level: 2, name: "Tháng 9, 2026" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tháng trước" }).getAttribute("href")).toBe("/tam-trang?thang=2026-08");
    expect((screen.getByRole("button", { name: "Tháng sau" }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector(".thang__tong")?.textContent).toBe("Linh ép 1 bông, Mạnh ép 2 bông");
    expect(container.querySelector(".lich__chu")?.textContent).toBe("Hàng trên là Linh, hàng dưới là Mạnh.");
  });

  it("thang cu: Thang sau la lien ket", () => {
    ve({ homNay: null, chonDau: 30, sauHref: "/tam-trang?thang=2026-10" });
    expect(screen.getByRole("link", { name: "Tháng sau" }).getAttribute("href")).toBe("/tam-trang?thang=2026-10");
  });
});

describe("LichHoa: o ngay", () => {
  it("chi ngay da qua moi bam duoc; nhan doc du hai nguoi; hom nay dang chon", () => {
    const { container } = ve();
    const oNgay = container.querySelectorAll("button.ngay");
    expect(oNgay).toHaveLength(22);
    const nay = screen.getByRole("button", { name: "22 tháng 9. Linh: Mưa phùn. Mạnh: Nắng ấm. Hôm nay" });
    expect(nay.getAttribute("aria-pressed")).toBe("true");
    expect(nay.className).toBe("ngay ngay--nay");
    expect(screen.getByRole("button", { name: "1 tháng 9. Linh: chưa thả. Mạnh: chưa thả" }).getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll(".ngay--xa")).toHaveLength(8);
    expect(container.querySelectorAll(".tuan")[4].className).toBe("tuan tuan--xa");
  });

  it("hai lan hoa: tren nguoi kia, duoi nguoi xem; hoa xoay bang transform, lan trong la vong cham", () => {
    ve();
    const nay = screen.getByRole("button", { name: /^22 tháng 9/ });
    const hoa = nay.querySelectorAll("svg.hoa use");
    expect([...hoa].map((u) => u.getAttribute("href"))).toEqual(["#hoa-hue-mua", "#hoa-cuc"]);
    expect([...hoa].map((u) => u.getAttribute("transform"))).toEqual(["rotate(-6 24 24)", "rotate(5 24 24)"]);
    const hom = screen.getByRole("button", { name: /^21 tháng 9/ });
    expect(hom.children[1].className).toBe("hoa-trong");
    expect(hom.querySelector("use")?.hasAttribute("transform")).toBe(false);
  });

  it("bam mot ngay: khung chi tiet doi theo, chip Hom nay chi o hom nay", () => {
    const { container } = ve();
    const chiTiet = container.querySelector(".chi-tiet") as HTMLElement;
    expect(chiTiet.querySelector("h2")?.textContent).toBe("Thứ Ba, 22.09");
    expect(chiTiet.querySelector(".chip")?.textContent).toBe("Hôm nay");
    expect([...chiTiet.querySelectorAll(".chi-tiet__ai")].map((p) => p.textContent)).toEqual(["Linh: mưa phùn", "Mạnh: nắng ấm"]);
    expect([...chiTiet.querySelectorAll(".chi-tiet__gio")].map((p) => p.textContent)).toEqual(["Huệ mưa, 21:40", "Hoa cúc, 08:15"]);
    expect(chiTiet.querySelector(".chi-tiet__nhan")?.textContent).toBe("Nhớ cậu một chút thôi.");

    fireEvent.click(screen.getByRole("button", { name: /^21 tháng 9/ }));
    expect(chiTiet.querySelector("h2")?.textContent).toBe("Thứ Hai, 21.09");
    expect(chiTiet.querySelector(".chip")).toBeNull();
    expect([...chiTiet.querySelectorAll(".chi-tiet__ai")].map((p) => p.textContent)).toEqual(["Linh chưa thả tâm trạng.", "Mạnh: giông"]);
    expect(screen.getByRole("button", { name: /^21 tháng 9/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^22 tháng 9/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("LichHoa: chu giai", () => {
  it("chin bong hoa kem ten kieu troi va ten hoa, khong co style noi tuyen nao", () => {
    const { container } = ve();
    const giai = screen.getByRole("region", { name: "Chú giải" });
    expect(giai.querySelector("h2")?.textContent).toBe("Chín bông hoa");
    expect([...giai.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Nắng ấmHoa cúc", "Trời trongLưu ly", "Mây nhẹBồ công anh", "Gió thoảngBông lau", "Mưa phùnHuệ mưa",
      "Mưa ràoCẩm tú cầu", "GiôngBằng lăng", "Sương mùHoa baby", "Cầu vồngHoa bướm",
    ]);
    expect(container.querySelector("[style]")).toBeNull();
  });
});

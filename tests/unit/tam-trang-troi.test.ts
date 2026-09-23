import { describe, it, expect } from "vitest";
import { FLOWERS, isWeather, TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";

/*
 * Bo tho da duyet, chep nguyen van tung dong "khoa|tho<br>tho|giai nghia|nguon". Test so tung chu voi TROI, nen
 * mot lan sua tho ma khong duyet lai se do o day.
 */
const THO_CO = [
  "nang-am|Cỏ non xanh tận chân trời<br>Cành lê trắng điểm một vài bông hoa||Nguyễn Du, Truyện Kiều",
  "troi-trong|Trời thu xanh ngắt mấy tầng cao<br>Cần trúc lơ phơ gió hắt hiu||Nguyễn Khuyến, Thu vịnh",
  "may-nhe|Hạc vàng đi mất từ xưa<br>Nghìn năm mây trắng bây giờ còn bay||Thôi Hiệu, Hoàng Hạc lâu (Tản Đà dịch)",
  "gio-thoang|Sóng biếc theo làn hơi gợn tí<br>Lá vàng trước gió khẽ đưa vèo||Nguyễn Khuyến, Thu điếu",
  "mua-phun|Tùy phong tiềm nhập dạ<br>Nhuận vật tế vô thanh|Mưa theo gió lặng vào đêm, thấm muôn vật nhỏ nhẹ không thành tiếng|Đỗ Phủ, Xuân dạ hỉ vũ",
  "mua-rao|Thanh minh thời tiết vũ phân phân<br>Lộ thượng hành nhân dục đoạn hồn|Tiết thanh minh mưa rơi lả tả, người đi đường buồn như đứt ruột|Đỗ Mục, Thanh minh",
  "giong|Buồn trông gió cuốn mặt duềnh<br>Ầm ầm tiếng sóng kêu quanh ghế ngồi||Nguyễn Du, Truyện Kiều",
  "suong-mu|Nguyệt lạc ô đề sương mãn thiên<br>Giang phong ngư hỏa đối sầu miên|Trăng lặn, quạ kêu, sương giăng đầy trời, lửa chài bên cây phong đối giấc ngủ buồn|Trương Kế, Phong Kiều dạ bạc",
  "cau-vong|Sen tàn cúc lại nở hoa<br>Sầu dài ngày ngắn đông đà sang xuân||Nguyễn Du, Truyện Kiều",
];

describe("chin kieu troi", () => {
  it("dung chin khoa, dung thu tu cua ban mau", () => {
    expect([...WEATHERS]).toEqual(["nang-am", "troi-trong", "may-nhe", "gio-thoang", "mua-phun", "mua-rao", "giong", "suong-mu", "cau-vong"]);
  });

  it("tho, giai nghia, nguon khop nguyen van bo da duyet", () => {
    expect(THO_CO).toHaveLength(WEATHERS.length);
    for (const dong of THO_CO) {
      const [khoa, tho, giai, nguon] = dong.split("|");
      expect(isWeather(khoa), khoa).toBe(true);
      const t = TROI[khoa as Weather];
      expect(t.tho.join("<br>"), khoa).toBe(tho);
      expect(t.giai, khoa).toBe(giai === "" ? null : giai);
      expect(t.nguon, khoa).toBe(nguon);
    }
  });

  it("chi tho Han Viet co giai nghia", () => {
    expect(WEATHERS.filter((k) => TROI[k].giai !== null)).toEqual(["mua-phun", "mua-rao", "suong-mu"]);
  });

  it("ten kieu, ten hoa dung ban mau; moi kieu mot bong hoa rieng theo dung thu tu FLOWERS", () => {
    expect(WEATHERS.map((k) => TROI[k].ten)).toEqual(["Nắng ấm", "Trời trong", "Mây nhẹ", "Gió thoảng", "Mưa phùn", "Mưa rào", "Giông", "Sương mù", "Cầu vồng"]);
    expect(WEATHERS.map((k) => TROI[k].tenHoa)).toEqual(["Hoa cúc", "Lưu ly", "Bồ công anh", "Bông lau", "Huệ mưa", "Cẩm tú cầu", "Bằng lăng", "Hoa baby", "Hoa bướm"]);
    expect(WEATHERS.map((k) => TROI[k].hoa)).toEqual([...FLOWERS]);
    expect(new Set(FLOWERS).size).toBe(9);
  });

  it("isWeather chi nhan dung chin khoa", () => {
    for (const k of WEATHERS) expect(isWeather(k)).toBe(true);
    for (const x of ["", "Nang-am", "mua", null, undefined, 1, {}]) expect(isWeather(x)).toBe(false);
  });
});

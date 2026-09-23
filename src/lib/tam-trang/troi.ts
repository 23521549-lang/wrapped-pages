/*
 * Chin kieu troi cua Tha tam trang va thu hien kem moi kieu: ten, bong hoa ep, hai cau tho. Ham thuan, khong
 * import gi ngoai src/lib. WEATHERS phai khop CHECK moods_weather cua src/server/db/schema.ts, cung thu tu (co test).
 *
 * Tho la tho co noi tieng, het ban quyen (Nguyen Du, Nguyen Khuyen, tho Duong, ban dich Tan Da), chep nguyen van
 * bo da duyet. Khong cau nao co ten nguoi: dai troi la cua nguoi kia, cau tho chi goi khong khi. Tho Han Viet kem
 * mot dong giai nghia de ai cung hieu.
 */
export const WEATHERS = ["nang-am", "troi-trong", "may-nhe", "gio-thoang", "mua-phun", "mua-rao", "giong", "suong-mu", "cau-vong"] as const;
export type Weather = (typeof WEATHERS)[number];

export const FLOWERS = ["cuc", "luu-ly", "bo-cong-anh", "bong-lau", "hue-mua", "cam-tu-cau", "bang-lang", "hoa-baby", "hoa-buom"] as const;
export type FlowerKey = (typeof FLOWERS)[number];

export type TroiInfo = {
  /** Ten kieu troi hien tren o chon va chu giai. */
  ten: string;
  hoa: FlowerKey;
  tenHoa: string;
  /** Hai cau tho, moi cau mot dong. */
  tho: readonly [string, string];
  /** Giai nghia mot dong cho tho Han Viet; tho Nom va ban dich thi null. */
  giai: string | null;
  /** Tac gia, ten bai. */
  nguon: string;
};

export const TROI: Record<Weather, TroiInfo> = {
  "nang-am": {
    ten: "Nắng ấm", hoa: "cuc", tenHoa: "Hoa cúc",
    tho: ["Cỏ non xanh tận chân trời", "Cành lê trắng điểm một vài bông hoa"], giai: null, nguon: "Nguyễn Du, Truyện Kiều",
  },
  "troi-trong": {
    ten: "Trời trong", hoa: "luu-ly", tenHoa: "Lưu ly",
    tho: ["Trời thu xanh ngắt mấy tầng cao", "Cần trúc lơ phơ gió hắt hiu"], giai: null, nguon: "Nguyễn Khuyến, Thu vịnh",
  },
  "may-nhe": {
    ten: "Mây nhẹ", hoa: "bo-cong-anh", tenHoa: "Bồ công anh",
    tho: ["Hạc vàng đi mất từ xưa", "Nghìn năm mây trắng bây giờ còn bay"], giai: null, nguon: "Thôi Hiệu, Hoàng Hạc lâu (Tản Đà dịch)",
  },
  "gio-thoang": {
    ten: "Gió thoảng", hoa: "bong-lau", tenHoa: "Bông lau",
    tho: ["Sóng biếc theo làn hơi gợn tí", "Lá vàng trước gió khẽ đưa vèo"], giai: null, nguon: "Nguyễn Khuyến, Thu điếu",
  },
  "mua-phun": {
    ten: "Mưa phùn", hoa: "hue-mua", tenHoa: "Huệ mưa",
    tho: ["Tùy phong tiềm nhập dạ", "Nhuận vật tế vô thanh"],
    giai: "Mưa theo gió lặng vào đêm, thấm muôn vật nhỏ nhẹ không thành tiếng", nguon: "Đỗ Phủ, Xuân dạ hỉ vũ",
  },
  "mua-rao": {
    ten: "Mưa rào", hoa: "cam-tu-cau", tenHoa: "Cẩm tú cầu",
    tho: ["Thanh minh thời tiết vũ phân phân", "Lộ thượng hành nhân dục đoạn hồn"],
    giai: "Tiết thanh minh mưa rơi lả tả, người đi đường buồn như đứt ruột", nguon: "Đỗ Mục, Thanh minh",
  },
  giong: {
    ten: "Giông", hoa: "bang-lang", tenHoa: "Bằng lăng",
    tho: ["Buồn trông gió cuốn mặt duềnh", "Ầm ầm tiếng sóng kêu quanh ghế ngồi"], giai: null, nguon: "Nguyễn Du, Truyện Kiều",
  },
  "suong-mu": {
    ten: "Sương mù", hoa: "hoa-baby", tenHoa: "Hoa baby",
    tho: ["Nguyệt lạc ô đề sương mãn thiên", "Giang phong ngư hỏa đối sầu miên"],
    giai: "Trăng lặn, quạ kêu, sương giăng đầy trời, lửa chài bên cây phong đối giấc ngủ buồn", nguon: "Trương Kế, Phong Kiều dạ bạc",
  },
  "cau-vong": {
    ten: "Cầu vồng", hoa: "hoa-buom", tenHoa: "Hoa bướm",
    tho: ["Sen tàn cúc lại nở hoa", "Sầu dài ngày ngắn đông đà sang xuân"], giai: null, nguon: "Nguyễn Du, Truyện Kiều",
  },
};

export function isWeather(x: unknown): x is Weather {
  return typeof x === "string" && (WEATHERS as readonly string[]).includes(x);
}

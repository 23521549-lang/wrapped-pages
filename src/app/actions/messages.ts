/*
 * Thong diep dung chung cua cac server action. Khong dat trong library.ts: file "use server" chi duoc
 * export ham async, export mot hang so thi next build bao loi.
 */
export const CAN_DANG_NHAP = "Bạn cần đăng nhập trước.";

/** Cuon sach khong phai cua nguoi dang nhap hoac khong con: tra loi nhu cuon khong ton tai. */
export const KHONG_THAY_SACH = "Không tìm thấy cuốn sách này.";

/** Luu lua chon tat nhac khong duoc: action bao loi, hay MusicRoom goi action nem loi (mat mang). */
export const CHUA_LUU_NHAC = "Chưa lưu được lựa chọn nhạc.";

/**
 * Kho media chua bat (chay tren Vercel ma thieu bien MEDIA_S3_): tai len tat em, web van chay. Cau nay chan ca
 * ba loai media (anh trong trang, ghi am, bia), nen phai noi dung ca ba - va trung voi cau man viet hien san.
 */
export const CHUA_BAT_KHO_MEDIA = "Chưa bật kho lưu ảnh và ghi âm.";

/** Chu sach luu mot luot ma luot do vua duoc luu o the khac: man sua nhan ra cau nay de moi tai lai. */
export const LUOT_VUA_SUA_NOI_KHAC = "Lượt này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.";

/** Tha hay thu lai tam trang khong xong vi action nem loi (mat mang): hop chon hien cau nay, giu nguyen lua chon. */
export const CHUA_THA_DUOC = "Chưa lưu được tâm trạng. Thử lại nhé.";

import { COVER_NAME } from "@/lib/book";
import { pageRange, pageRangeTitle } from "@/lib/seal/reader";
import type { SealKind } from "@/lib/seal/types";
import { phanThang, tenThang, thangKhoa } from "@/lib/tam-trang/lich";
import { TROI } from "@/lib/tam-trang/troi";
import {
  docChiTietBia, docChiTietDaDoc, docChiTietNhac, docChiTietNhanViet, docChiTietTen, docChiTietTenLuot, docChiTietThu,
  docChiTietTuChoi, type GiaTriBia, type GiaTriNhac,
} from "./detail";
import type { FeedItem } from "./types";

/** Mot doan cua cau: chu thuong hay chu dam (ten sach, ten moi, ca cau bao mat khau bi doi). */
export type DoanCau = { chu: string; dam: boolean };
/** Cau cua mot dong, noi cac doan theo thu tu; doan dau thuong bat dau bang ten nguoi lam. */
export type FeedSentence = readonly DoanCau[];

/** Dong phu duoi cau: loi nhan (tang chia khoa, tha tam trang: chu cua nguoi viet) hoac ghi chu cua web. */
export type FeedExtra = { kind: "loi-nhan" | "ghi-chu"; text: string };

/** O tron dau dong: chu cai dau cua nguoi lam, hoac dong ho khi hen gio tu mo. */
export type FeedAvatar = "me" | "partner" | "hen-gio";

/** Mot dong Hoat dong da thanh chu, co cau truc: giao dien tu ve, khong bao gio la chuoi HTML. */
export type FeedLine = {
  sentence: FeedSentence;
  chips: string[];
  extra: FeedExtra | null;
  /** Cho bam dong nay mo ra; null voi dong khong gan gi. */
  href: string | null;
  avatar: FeedAvatar;
};

/** Ten bai va kenh lay tu YouTube o may chu (tenCacBai); bai lay khong duoc thi khong co khoa. */
export type TenBaiHat = Record<string, { ten: string; kenh: string | null }>;

/** Biet danh hien tai cua nguoi kia va ten cac bai nhac, doc luc ve; dong Hoat dong khong mang ten ai. */
export type FeedNames = { partner: string; baiHat?: TenBaiHat };

const TEN_NIEM_PHONG: Record<SealKind, string> = { "cau-do": "Câu đố", "hen-gio": "Hẹn giờ", "trao-doi": "Trao đổi" };
const THAY_TEN_BAI = "Bản nhạc trên YouTube";

const thuong = (chu: string): DoanCau => ({ chu, dam: false });
const dam = (chu: string): DoanCau => ({ chu, dam: true });

/** Phan gan sach cua mot su kien. Moi loai tru doi-mat-khau, tha-tam-trang va gui-thu deu co cuon (CHECK activity_sach). */
function sachCua(item: FeedItem) {
  const { bookId, bookTitle } = item;
  if (bookId === null || bookTitle === null) throw new Error(`su kien ${item.kind} thieu sach`);
  return { bookId, title: bookTitle };
}

/** Khoang to cua luot, voi cac loai gan luot (CHECK activity_sach bat round_id). */
function khoangCua(item: FeedItem) {
  const { firstPosition, lastPosition } = item;
  if (firstPosition === null || lastPosition === null) throw new Error(`su kien ${item.kind} thieu sach`);
  return { first: firstPosition, last: lastPosition };
}

/** "lượt 2" hay "lúc tạo sách" (o mo dau cua dong thoi gian bia, nhac). */
const tenO = (ordinal: number | null) => (ordinal === null ? "lúc tạo sách" : `lượt ${ordinal}`);

function nhanBia(v: GiaTriBia, ai: string): string {
  if (v === null) return "Giữ bìa trước";
  return v.anhId !== null ? `Ảnh của ${ai === "Bạn" ? "bạn" : ai}` : COVER_NAME[v.cover];
}

function nhanNhac(v: GiaTriNhac, baiHat: TenBaiHat): string {
  if (v === null) return "Phát tiếp bài trước";
  if (v.youtubeId === null) return "Tắt nhạc";
  const bai = baiHat[v.youtubeId];
  if (!bai) return THAY_TEN_BAI;
  return bai.kenh === null ? bai.ten : `${bai.ten}, ${bai.kenh}`;
}

/**
 * Cau cua mot dong Hoat dong, theo nguoi xem: viec cua chinh nguoi xem mo dau bang "Bạn", nguoi kia goi bang biet
 * danh. Ten sach dam. Chip la kieu niem phong, so lan thu sai da gom, "Bìa mới"/"Nhạc mới" cua lan dang, hay gia tri
 * moi cua o bia, o nhac. Khong doc hay tra id tai khoan nao.
 */
export function feedLine(item: FeedItem, names: FeedNames): FeedLine {
  const mine = item.by === "me";
  const ai = mine ? "Bạn" : names.partner;
  const avatar: FeedAvatar = mine ? "me" : "partner";
  const baiHat = names.baiHat ?? {};

  if (item.kind === "doi-mat-khau") {
    const dong = { chips: [], href: null, avatar };
    if (mine) return { ...dong, sentence: [thuong(`Bạn đổi mật khẩu của ${names.partner}`)], extra: null };
    return {
      ...dong,
      sentence: [dam(`${names.partner} vừa đổi mật khẩu của bạn`)],
      // Doi ten khong xoa phien dang nhap nao (renamePartner chi sua accounts), va web khong co nut dang xuat.
      extra: { kind: "ghi-chu", text: `Máy này vẫn đăng nhập. Hỏi ${names.partner} mật khẩu mới để vào ở máy khác.` },
    };
  }

  if (item.kind === "tha-tam-trang") {
    return {
      sentence: [thuong(`${ai} thả tâm trạng `), dam(item.weather === null ? "mới" : TROI[item.weather].ten)],
      chips: [],
      extra: item.note === null ? null : { kind: "loi-nhan", text: item.note },
      href: "/tam-trang",
      avatar,
    };
  }

  // Thu thang: dan toi Lich hoa, o dung thang (tam-trang/page mo o do va cuon toi cho thu).
  if (item.kind === "gui-thu") {
    const t = phanThang(docChiTietThu(item.detail)?.thang);
    const ten = t === null ? "thư tháng" : `thư ${tenThang(t)}`;
    return {
      sentence: mine ? [thuong("Bạn đã gửi "), dam(ten), thuong(` cho ${names.partner}`)] : [thuong(`${ai} đã viết `), dam(ten), thuong(" cho bạn")],
      chips: [],
      extra: null,
      href: t === null ? "/tam-trang" : `/tam-trang#thu-${thangKhoa(t)}`,
      avatar,
    };
  }

  const sach = sachCua(item);
  const moSach = `/sach/${sach.bookId}`;
  const cau = (before: string, after = ""): FeedSentence => [thuong(before), dam(sach.title), ...(after === "" ? [] : [thuong(after)])];
  const dong = (sentence: FeedSentence, href: string, chips: string[] = []): FeedLine => ({ sentence, chips, extra: null, href, avatar });
  const nguoiKia = mine ? names.partner : "bạn";

  switch (item.kind) {
    // Sach viet cung (5c): cac de nghi va cau tra loi gan ca cuon, dan toi cuon (man doc co nut nhan loi, xin, rut).
    case "moi-viet":
      return dong(cau(`${ai} mời ${nguoiKia} viết cùng `), moSach);
    case "xin-viet":
      return dong(cau(`${ai} xin viết cùng `), moSach);
    case "nhan-viet":
      return docChiTietNhanViet(item.detail)?.tu === "xin-viet"
        ? dong(cau(`${ai} đồng ý cho ${nguoiKia} viết cùng `), moSach)
        : dong(cau(`${ai} nhận lời viết cùng `), moSach);
    case "tu-choi": {
      const viec = docChiTietTuChoi(item.detail)?.viec;
      if (viec === "moi-viet") return dong(cau(`${ai} chưa nhận lời viết cùng `), moSach);
      if (viec === "xin-viet") return dong(cau(`${ai} chưa đồng ý cho ${nguoiKia} viết cùng `), moSach);
      if (viec === "xoa-sach") return dong(cau(`${ai} muốn giữ lại `), moSach);
      return dong(cau(`${ai} trả lời đề nghị về `), moSach);
    }
    // Dong y hay giu lai nam o muc Xoa cuon cua Sua sach (va o Ke sach).
    case "de-nghi-xoa":
      return dong(cau(`${ai} đề nghị xóa `), `${moSach}/sua`);
    case "doi-ten-luot": {
      const ten = docChiTietTenLuot(item.detail);
      const toi = item.firstPosition === null ? moSach : `${moSach}?trang=${item.firstPosition}`;
      return ten === null || item.ordinal === null
        ? dong(cau(`${ai} đổi tên một lượt của `), toi)
        : dong([thuong(`${ai} đổi tên lượt ${item.ordinal} của `), dam(sach.title), thuong(" thành "), dam(ten.sau)], toi);
    }
    case "tao-sach":
      return dong(cau(`${ai} tạo cuốn `), moSach);
    case "doi-ten-sach": {
      const ten = docChiTietTen(item.detail);
      return ten === null
        ? dong(cau(`${ai} đổi tên cuốn `), moSach)
        : dong([thuong(`${ai} đổi tên `), dam(ten.truoc), thuong(" thành "), dam(ten.sau)], moSach);
    }
    case "doi-bia": {
      const bia = docChiTietBia(item.detail);
      return dong(cau(`${ai} đổi bìa ${tenO(item.ordinal)} của `), moSach, bia === null ? [] : [nhanBia(bia.sau, ai)]);
    }
    case "doi-nhac": {
      const nhac = docChiTietNhac(item.detail);
      return dong(cau(`${ai} đổi nhạc ${tenO(item.ordinal)} của `), `/dau-thoi-gian/${sach.bookId}`, nhac === null ? [] : [nhanNhac(nhac.sau, baiHat)]);
    }
    case "da-doc": {
      const doc = docChiTietDaDoc(item.detail);
      const den = doc?.den ?? khoangCua(item).last;
      return dong(cau(`${ai} đã đọc tới trang ${den} của `), `${moSach}?trang=${den}`);
    }
    default:
      break;
  }

  const k = khoangCua(item);
  const trang = pageRange(k.first, k.last);
  let sentence: FeedSentence;
  switch (item.kind) {
    case "dang-trang":
      // Sach viet cung: moi luot co ten rieng, nhu mot chuong (5c muc I2).
      sentence = item.tenLuot === null
        ? cau(`${ai} đăng ${k.last - k.first + 1} trang mới trong `)
        : [thuong(`${ai} viết lượt `), dam(item.tenLuot), thuong(" trong "), dam(sach.title)];
      break;
    case "moi-trao-doi":
      sentence = cau(`${ai} mời ${nguoiKia} viết trang trả lời trong `);
      break;
    case "mo-hen-gio":
      sentence = cau(`${pageRangeTitle(k.first, k.last)} của `, " đã tới giờ mở");
      break;
    case "mo-trang":
      sentence = item.sealKind === "trao-doi"
        ? cau(`${ai} gửi trang trả lời cho ${trang} trong `)
        : cau(`${ai} mở được ${trang} trong `);
      break;
    case "thu-sai":
      sentence = cau(`${ai} thử ${trang} trong `, ", chưa đúng");
      break;
    case "tang-khoa":
      sentence = cau(`${ai} tặng ${nguoiKia} chìa khóa ${trang} trong `);
      break;
    case "hoi-dap":
      sentence = cau(`${ai} đã hồi đáp ${trang} của `);
      break;
    case "sua-trang":
      sentence = cau(`${ai} sửa ${trang} của `);
      break;
    default: {
      const khongCo: never = item.kind;
      throw new Error(`loai su kien la: ${String(khongCo)}`);
    }
  }

  const chips = item.sealKind === null ? [] : [TEN_NIEM_PHONG[item.sealKind]];
  if (item.count > 1) chips.push(`${item.count} lần`);
  if (item.kind === "dang-trang" && item.biaMoi) chips.push("Bìa mới");
  if (item.kind === "dang-trang" && item.nhacMoi) chips.push("Nhạc mới");
  return {
    sentence,
    chips,
    extra: item.note === null ? null : { kind: "loi-nhan", text: item.note },
    href: `${moSach}?trang=${k.first}`,
    avatar: item.kind === "mo-hen-gio" ? "hen-gio" : avatar,
  };
}

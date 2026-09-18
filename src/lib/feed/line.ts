import { pageRange, pageRangeTitle } from "@/lib/seal/reader";
import type { SealKind } from "@/lib/seal/types";
import type { FeedItem } from "./types";

/** Cau cua mot dong: before, roi strong in dam (ten sach, hoac ca cau bao mat khau bi doi; rong la khong dam), roi after. */
export type FeedSentence = { before: string; strong: string; after: string };

/** Dong phu duoi cau: loi nhan tang chia khoa (chu cua nguoi viet) hoac ghi chu cua web. */
export type FeedExtra = { kind: "loi-nhan" | "ghi-chu"; text: string };

/** O tron dau dong: chu cai dau cua nguoi lam, hoac dong ho khi hen gio tu mo. */
export type FeedAvatar = "me" | "partner" | "hen-gio";

/** Mot dong Hoat dong da thanh chu, co cau truc: giao dien tu ve, khong bao gio la chuoi HTML. */
export type FeedLine = {
  sentence: FeedSentence;
  chips: string[];
  extra: FeedExtra | null;
  /** To dau cua su kien trong man doc; null voi dong khong gan sach. */
  href: string | null;
  avatar: FeedAvatar;
};

/** Biet danh hien tai cua nguoi kia, doc luc ve; dong Hoat dong khong mang ten ai. */
export type FeedNames = { partner: string };

const TEN_NIEM_PHONG: Record<SealKind, string> = { "cau-do": "Câu đố", "hen-gio": "Hẹn giờ", "trao-doi": "Trao đổi" };

/** Phan gan sach cua mot su kien. Bang activity bat moi loai tru doi-mat-khau co du cac cot nay (CHECK activity_sach). */
function sachCua(item: FeedItem) {
  const { bookId, bookTitle, firstPosition, lastPosition } = item;
  if (bookId === null || bookTitle === null || firstPosition === null || lastPosition === null) {
    throw new Error(`su kien ${item.kind} thieu sach`);
  }
  return { bookId, title: bookTitle, first: firstPosition, last: lastPosition };
}

/**
 * Cau cua mot dong Hoat dong, theo nguoi xem: viec cua chinh nguoi xem mo dau bang "Bạn", nguoi kia goi bang biet
 * danh. Ten sach dam. Chip la kieu niem phong va so lan thu sai da gom. Khong doc hay tra id tai khoan nao.
 */
export function feedLine(item: FeedItem, names: FeedNames): FeedLine {
  const mine = item.by === "me";
  const ai = mine ? "Bạn" : names.partner;
  const avatar: FeedAvatar = mine ? "me" : "partner";

  if (item.kind === "doi-mat-khau") {
    const dong = { chips: [], href: null, avatar };
    if (mine) return { ...dong, sentence: { before: `Bạn đổi mật khẩu của ${names.partner}`, strong: "", after: "" }, extra: null };
    return {
      ...dong,
      sentence: { before: "", strong: `${names.partner} vừa đổi mật khẩu của bạn`, after: "" },
      // Doi ten khong xoa phien dang nhap nao (renamePartner chi sua accounts), va web khong co nut dang xuat.
      extra: { kind: "ghi-chu", text: `Máy này vẫn đăng nhập. Hỏi ${names.partner} mật khẩu mới để vào ở máy khác.` },
    };
  }

  const sach = sachCua(item);
  const trang = pageRange(sach.first, sach.last);
  const nguoiKia = mine ? names.partner : "bạn";
  const cau = (before: string, after = ""): FeedSentence => ({ before, strong: sach.title, after });
  let sentence: FeedSentence;
  switch (item.kind) {
    case "dang-trang":
      sentence = cau(`${ai} đăng ${sach.last - sach.first + 1} trang mới trong `);
      break;
    case "moi-trao-doi":
      sentence = cau(`${ai} mời ${nguoiKia} viết trang trả lời trong `);
      break;
    case "mo-hen-gio":
      sentence = cau(`${pageRangeTitle(sach.first, sach.last)} của `, " đã tới giờ mở");
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
    default: {
      const khongCo: never = item.kind;
      throw new Error(`loai su kien la: ${String(khongCo)}`);
    }
  }

  const chips = item.sealKind === null ? [] : [TEN_NIEM_PHONG[item.sealKind]];
  if (item.count > 1) chips.push(`${item.count} lần`);
  return {
    sentence,
    chips,
    extra: item.note === null ? null : { kind: "loi-nhan", text: item.note },
    href: `/sach/${sach.bookId}?trang=${sach.first}`,
    avatar: item.kind === "mo-hen-gio" ? "hen-gio" : avatar,
  };
}

import type { DocJson } from "@/lib/doc/types";

export const SEAL_KINDS = ["cau-do", "hen-gio", "trao-doi"] as const;
export type SealKind = (typeof SEAL_KINDS)[number];

export const SEAL_LIMITS = {
  questionMax: 200,
  answersMax: 5,
  answerMax: 100,
  hintsMax: 3,
  hintMax: 200,
  giftNoteMax: 200,
  guessMax: 200,
  /** Hen gio phai mo sau luc dang it nhat 1 phut. */
  minLeadMs: 60_000,
  /** Va nhieu nhat khoang 10 nam (3653 ngay tinh ca ngay nhuan). */
  maxLeadMs: 3653 * 86_400_000,
  /** Do dai toi da cua dong he lo. */
  teaserMax: 80,
  /**
   * Tran ky tu cua trang tra loi trao doi. Trang tra loi phai vua dung mot to; may chu khong
   * do duoc chu nen man viet giu luat mot to, con may chu chan mot tran rong rai gap khoang hai lan suc
   * chua cua mot to.
   */
  replyMaxChars: 1500,
} as const;

/** Niem phong da qua kiem, san sang luu. Dap an cua cau do da duoc chuan hoa. */
export type SealInput =
  | { kind: "cau-do"; question: string; answers: string[]; hints: string[] }
  | { kind: "hen-gio"; opensAt: Date }
  | { kind: "trao-doi"; question: string };

/**
 * Mot to trong man doc. To khoa van co content de man doc cu chay duoc, nhung content cua no do may
 * chu dung lai chi gom dong he lo, khong bao gio la noi dung that.
 */
export type ReaderSheet = {
  position: number;
  publishedAt: Date;
  content: DocJson;
  locked: boolean;
  sealId: string | null;
  /** Dong he lo, chi co tren to dau cua mot niem phong con khoa. */
  teaser: string | null;
};

export type KnockEntry = { guess: string; correct: boolean; at: Date };

/**
 * Sau luc mo bao lau thi may chu con cho chay nghi thuc mo: du cho redirect va tai trang ngay sau khi mo,
 * khong du de mot lan tai lai hay mot link chia se ve sau chay lai nghi thuc.
 */
export const RITUAL_WINDOW_MS = 2 * 60_000;

/** Trang thai mot niem phong nhu nguoi xem duoc phep biet. Khong bao gio chua dap an. */
export type ReaderSeal = {
  id: string;
  kind: SealKind;
  firstPosition: number;
  lastPosition: number;
  mine: boolean;
  locked: boolean;
  question: string | null;
  opensAt: Date | null;
  hints: string[];
  remaining: number | null;
  lockedUntil: Date | null;
  /** Luc nguoi kia mo duoc cau do hay trao doi. Hen gio luon null (rang buoc seals_hen_gio). */
  openedAt: Date | null;
  /** Chi true khi chinh nguoi xem vua tu mo niem phong nay trong RITUAL_WINDOW_MS. */
  ritual: boolean;
  giftNote: string | null;
  reply: DocJson | null;
  answerCount: number | null;
  knocks: KnockEntry[];
};

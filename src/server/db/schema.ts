import { sql } from "drizzle-orm";
import {
  pgTable, uuid, integer, text, timestamp, check, index, jsonb, primaryKey, uniqueIndex, boolean, type AnyPgColumn,
} from "drizzle-orm/pg-core";
// Chi import KIEU: drizzle-kit nap file nay bang bo nap rieng, khong hieu duong dan "@/";
// `import type` bi xoa hoan toan luc bien dich nen khong sao.
import type { BookMode, CoverKey } from "@/lib/book";
import type { DocJson } from "@/lib/doc/types";
import type { FeedKind } from "@/lib/feed/types";
import type { MediaKind, MediaMime } from "@/lib/media/kinds";
import type { SealKind } from "@/lib/seal/types";

/** Dung hai cho ngoi. Khong co vai dat san. */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  seat: integer("seat").notNull().unique(),
  nickname: text("nickname").notNull(),
  passwordHash: text("password_hash").notNull(),
  secretCipher: text("secret_cipher").notNull(),
  /** Dau trinh duyet cua NGUOI TAO. Rao mem chan ho dang nhap vao day. */
  createdByDevice: text("created_by_device").notNull(),
  /** Nguoi nay da tat nhac nen. Doc o man doc sach co nhac, ghi bang actionSetMusicMuted. */
  musicMuted: boolean("music_muted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  seatRange: check("seat_range", sql`${t.seat} in (1, 2)`),
}));

export const secretHistory = pgTable("secret_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  secretCipher: text("secret_cipher").notNull(),
  nickname: text("nickname").notNull(),
  /** true khi nguoi viet da bam Gui loi nhan cho ban nay. */
  revealed: integer("revealed").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byAccount: index("secret_history_account_idx").on(t.accountId) }));

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: text("device_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byDevice: index("login_attempts_device_idx").on(t.deviceId, t.at),
  byTime: index("login_attempts_at_idx").on(t.at),
}));

/**
 * Trinh duyet da tung dang nhap thanh cong (trinh duyet tin cay). Chi dung cho gioi han dang nhap sai:
 * trinh duyet tin cay khong bi khoa chung khi co nguoi dang do mat khau tu cac trinh duyet la
 * (src/server/identity/rate-limit.ts). Khong phai giay thong hanh: mat khau van phai dung.
 * Moi tai khoan chi giu MAX_TRUSTED_PER_ACCOUNT dong gan nhat nen bang co tran.
 */
export const trustedDevices = pgTable("trusted_devices", {
  deviceId: text("device_id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byAccount: index("trusted_devices_account_idx").on(t.accountId, t.lastLoginAt) }));

/**
 * Moi cuon thuoc dung mot nguoi. "chia-se": nguoi kia doc duoc; "rieng-tu": nguoi kia khong thay gi, ke ca ten.
 * Hai danh sach trong check phai khop MODES va COVERS cua src/lib/book.ts, mau cua books_youtube_id phai khop
 * YOUTUBE_ID cua src/lib/youtube.ts (co test).
 */
export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  mode: text("mode").$type<BookMode>().notNull(),
  cover: text("cover").$type<CoverKey>().notNull(),
  /** Ma video YouTube da chuan hoa cua nhac nen; null la khong co nhac. */
  youtubeId: text("youtube_id"),
  /**
   * Bia tu tai len; null la dung tranh ve san. cover van bat buoc: la nen khi anh chua tai hoac media tat.
   * Khoa ngoai vong voi media.book_id nen phai khai kieu tra ve AnyPgColumn.
   */
  coverMediaId: uuid("cover_media_id").references((): AnyPgColumn => media.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  modeValue: check("books_mode", sql`${t.mode} in ('chia-se', 'rieng-tu')`),
  coverValue: check("books_cover", sql`${t.cover} in ('nui-xa', 'khom-truc', 'trang-nuoc', 'chim-bay')`),
  youtubeIdValue: check("books_youtube_id", sql`${t.youtubeId} is null or ${t.youtubeId} ~ '^[A-Za-z0-9_-]{11}$'`),
  byOwner: index("books_owner_idx").on(t.ownerId),
}));

/**
 * Mot to giay da dang. Noi dung dong bang tu luc dang, nhu sach in, nen may nao cung thay cung cho ngat trang.
 * Vi tri lien nhau tu 1 trong moi cuon (publishDraft noi tiep sau to cuoi).
 */
export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  content: jsonb("content").$type<DocJson>().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byBookPosition: uniqueIndex("pages_book_position_idx").on(t.bookId, t.position),
  positionFromOne: check("pages_position", sql`${t.position} >= 1`),
}));

/** Moi cuon co toi da mot ban nhap, cua chinh chu sach. Nguoi kia khong bao gio thay. */
export const drafts = pgTable("drafts", {
  bookId: uuid("book_id").primaryKey().references(() => books.id, { onDelete: "cascade" }),
  content: jsonb("content").$type<DocJson>().notNull(),
  sheetCount: integer("sheet_count").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Moc "da doc toi dau" cua mot nguoi trong mot cuon: vi tri to lon nhat da doc. */
export const readMarks = pgTable("read_marks", {
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.accountId, t.bookId] }),
}));

/**
 * Mot niem phong phu mot lan dang: cac to tu firstPosition toi lastPosition cua mot cuon.
 * Dap an va goi y nam o day nhung khong bao gio roi may chu nguyen ven: chi src/server/seal/ quyet phan
 * nao duoc gui xuong. teaser la dong he lo cat san luc dang, phan duy nhat cua to khoa duoc phep lo.
 */
export const seals = pgTable("seals", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  firstPosition: integer("first_position").notNull(),
  lastPosition: integer("last_position").notNull(),
  kind: text("kind").$type<SealKind>().notNull(),
  question: text("question"),
  answers: jsonb("answers").$type<string[]>().notNull().default([]),
  hints: jsonb("hints").$type<string[]>().notNull().default([]),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  /** Moc mo cho nguoi kia: tra loi dung, duoc tang chia khoa, hoac gui trang tra loi. Hen gio khong dung cot nay. */
  openedAt: timestamp("opened_at", { withTimezone: true }),
  giftNote: text("gift_note"),
  teaser: text("teaser").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  kindValue: check("seals_kind", sql`${t.kind} in ('cau-do', 'hen-gio', 'trao-doi')`),
  range: check("seals_range", sql`${t.firstPosition} >= 1 and ${t.lastPosition} >= ${t.firstPosition}`),
  henGio: check(
    "seals_hen_gio",
    sql`${t.kind} <> 'hen-gio' or (${t.opensAt} is not null and ${t.question} is null and ${t.openedAt} is null and ${t.giftNote} is null)`,
  ),
  thuThach: check("seals_thu_thach", sql`${t.kind} = 'hen-gio' or (${t.question} is not null and ${t.opensAt} is null)`),
  dapAn: check(
    "seals_dap_an",
    sql`(${t.kind} = 'cau-do' and jsonb_array_length(${t.answers}) between 1 and 5) or (${t.kind} <> 'cau-do' and jsonb_array_length(${t.answers}) = 0)`,
  ),
  goiY: check(
    "seals_goi_y",
    sql`jsonb_array_length(${t.hints}) <= 3 and (${t.kind} = 'cau-do' or jsonb_array_length(${t.hints}) = 0)`,
  ),
  cauHoi: check("seals_cau_hoi", sql`${t.question} is null or char_length(${t.question}) between 1 and 200`),
  loiNhan: check("seals_loi_nhan", sql`${t.giftNote} is null or char_length(${t.giftNote}) <= 200`),
  heLo: check("seals_he_lo", sql`char_length(${t.teaser}) <= 81`),
  byBookFirst: uniqueIndex("seals_book_first_idx").on(t.bookId, t.firstPosition),
}));

/** Moi lan nguoi kia go dap an cho mot cau do. La nhat ky go cua cua nguoi viet, va nguon cua goi y, ha nhiet. */
export const sealAttempts = pgTable("seal_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sealId: uuid("seal_id").notNull().references(() => seals.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  guess: text("guess").notNull(),
  correct: boolean("correct").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  guessLength: check("seal_attempts_guess", sql`char_length(${t.guess}) <= 200`),
  bySealAt: index("seal_attempts_seal_at_idx").on(t.sealId, t.at),
}));

/** Trang tra loi cua mot trao doi, dung mot to, cua nguoi kia. Moi niem phong nhieu nhat mot trang tra loi. */
export const sealReplies = pgTable("seal_replies", {
  sealId: uuid("seal_id").primaryKey().references(() => seals.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  content: jsonb("content").$type<DocJson>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Dong Hoat dong: moi hang mot su kien, khong co cot chu tu do nao. Ten sach, kieu niem phong va loi nhan tang
 * chia khoa join luc doc, nen noi dung trang, chuoi da go, dap an va mat khau khong co duong vao day.
 * shared: cuon dang chia se ngay luc ghi. Danh sach trong activity_kind phai khop FEED_KINDS cua
 * src/lib/feed/types.ts (co test).
 */
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").$type<FeedKind>().notNull(),
  actorId: uuid("actor_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  /** Nguoi bi doi mat khau. Chi doi-mat-khau co. */
  subjectId: uuid("subject_id").references(() => accounts.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  sealId: uuid("seal_id").references(() => seals.id, { onDelete: "cascade" }),
  firstPosition: integer("first_position"),
  lastPosition: integer("last_position"),
  shared: boolean("shared").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
}, (t) => ({
  kindValue: check(
    "activity_kind",
    sql`${t.kind} in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau')`,
  ),
  sach: check(
    "activity_sach",
    sql`${t.kind} = 'doi-mat-khau' or (${t.bookId} is not null and ${t.subjectId} is null and ${t.firstPosition} is not null and ${t.lastPosition} is not null and ${t.firstPosition} >= 1 and ${t.lastPosition} >= ${t.firstPosition})`,
  ),
  niemPhong: check("activity_niem_phong", sql`${t.kind} in ('dang-trang', 'doi-mat-khau') or ${t.sealId} is not null`),
  matKhau: check(
    "activity_mat_khau",
    sql`${t.kind} <> 'doi-mat-khau' or (${t.subjectId} is not null and ${t.subjectId} <> ${t.actorId} and ${t.bookId} is null and ${t.sealId} is null and ${t.firstPosition} is null and ${t.lastPosition} is null and ${t.shared} = false)`,
  ),
  byAt: index("activity_at_idx").on(t.at),
}));

/**
 * Mot tep media da put vao kho. Khong co cot chu tu do: key object chi gom tien to sach hoac cho, uuid
 * va duoi. book_id null chi cho bia cho gan luc tao sach. Cac danh sach va tran trong CHECK phai khop
 * src/lib/media/kinds.ts, mau cua media_store_key phai khop STORE_KEY cua src/lib/media/key.ts (co test).
 */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  kind: text("kind").$type<MediaKind>().notNull(),
  mime: text("mime").$type<MediaMime>().notNull(),
  bytes: integer("bytes").notNull(),
  /** Kich thuoc that cua anh va bia, diem anh. Ghi am luon null. */
  width: integer("width"),
  height: integer("height"),
  /** Thoi luong va song am cua ghi am. Anh va bia luon null. */
  durationMs: integer("duration_ms"),
  peaks: jsonb("peaks").$type<number[]>(),
  storeKey: text("store_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  kindValue: check("media_kind", sql`${t.kind} in ('anh', 'ghi-am', 'bia')`),
  sach: check("media_sach", sql`${t.bookId} is not null or ${t.kind} = 'bia'`),
  bytes: check("media_bytes", sql`${t.bytes} between 1 and (case when ${t.kind} = 'ghi-am' then 2097152 else 1048576 end)`),
  anh: check(
    "media_anh",
    sql`${t.kind} = 'ghi-am' or (${t.mime} in ('image/webp', 'image/jpeg') and ${t.width} is not null and ${t.height} is not null and ${t.width} between 1 and 1200 and ${t.height} between 1 and 1600 and ${t.durationMs} is null and ${t.peaks} is null)`,
  ),
  bia: check("media_bia", sql`${t.kind} <> 'bia' or ${t.width} * 3 = ${t.height} * 5`),
  ghiAm: check(
    "media_ghi_am",
    sql`${t.kind} <> 'ghi-am' or (${t.mime} in ('audio/webm', 'audio/mp4') and ${t.width} is null and ${t.height} is null and ${t.durationMs} is not null and ${t.durationMs} between 1 and 180000 and ${t.peaks} is not null and case when jsonb_typeof(${t.peaks}) = 'array' then jsonb_array_length(${t.peaks}) = 48 and not jsonb_path_exists(${t.peaks}, '$[*] ? (@.type() != "number" || @ < 0 || @ > 100 || @.floor() != @)') else false end)`,
  ),
  storeKeyValue: check(
    "media_store_key",
    sql`${t.storeKey} ~ '^(cho|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[/][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg|webm|m4a)$'`,
  ),
  byBook: index("media_book_idx").on(t.bookId),
  byOwnerCreated: index("media_owner_created_idx").on(t.ownerId, t.createdAt),
}));

/**
 * So cai object da hoac sap put vao kho media. Ghi truoc khi put va khong co khoa ngoai, nen song lau hon dong
 * media: object cua dong media da bi don, cua sach da xoa (dong media mat theo cascade) hay put xong ma ghi dong hong van
 * tim lai duoc de xoa. Mau cua media_objects_store_key phai khop STORE_KEY cua src/lib/media/key.ts (co test).
 */
export const mediaObjects = pgTable("media_objects", {
  storeKey: text("store_key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  storeKeyValue: check(
    "media_objects_store_key",
    sql`${t.storeKey} ~ '^(cho|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[/][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg|webm|m4a)$'`,
  ),
}));

/** Moc lan don rac media gan nhat: dung mot dong id = 1, chan tan suat chung cho moi tien trinh may chu. */
export const mediaSweeps = pgTable("media_sweeps", {
  id: integer("id").primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
}, (t) => ({
  one: check("media_sweeps_one", sql`${t.id} = 1`),
}));

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("thieu DATABASE_URL");
  return drizzle(postgres(url, { prepare: false }), { schema });
}

type RealDb = ReturnType<typeof connect>;
let instance: RealDb | undefined;

/**
 * Ket noi luoi: import file nay KHONG bao gio nem loi.
 * Chi khi co truy van dau tien ma thieu DATABASE_URL moi nem, voi thong diep ro rang.
 * Nho vay `next build` va moi module import file nay van chay duoc khi chua dat bien moi truong.
 */
export const db: RealDb = new Proxy({} as RealDb, {
  get(_target, prop) {
    instance ??= connect();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  // Khong bay getPrototypeOf thi Proxy tra ve prototype cua target rong `{}`, nen
  // `is(db, PgDatabase)` va `db instanceof PgDatabase` deu tra ve false du db hoat
  // dong dung, ma ma nguon co the can hai kiem tra nay. Chuyen
  // tiep thang toi doi tuong that de prototype chain khop voi PgDatabase that.
  getPrototypeOf() {
    instance ??= connect();
    return Reflect.getPrototypeOf(instance);
  },
});

export type Db = RealDb;

/** Chuoi mau trong .env.example: khong bao gio duoc dung that, chi de nhac phai tu doi. */
const CHUOI_MAU = "doi-chuoi-nay-thanh-mot-chuoi-ngau-nhien-dai";
const DO_DAI_TOI_THIEU = 32;

/**
 * SERVER_KEY vua la khoa HMAC sinh moi mat khau, vua la khoa AES-256-GCM ma hoa
 * moi loi nhan bi mat. Xoay khoa nay sau khi da co du lieu lam hong vinh vien moi
 * secret_cipher da luu va moi mat khau da sinh, nen phai chan tu luc doc, khong
 * bao gio duoc de mot khoa yeu hoac khoa mau lot qua. Khong bao gio in gia tri k.
 */
export function getServerKey(): string {
  const k = process.env.SERVER_KEY;
  if (!k) throw new Error("thieu SERVER_KEY");
  if (k.length < DO_DAI_TOI_THIEU) {
    throw new Error(`SERVER_KEY qua ngan, can it nhat ${DO_DAI_TOI_THIEU} ky tu. Hay dat mot chuoi ngau nhien dai hon.`);
  }
  if (k === CHUOI_MAU) {
    throw new Error("SERVER_KEY dang la chuoi mau trong .env.example. Hay doi thanh mot chuoi ngau nhien rieng cua ban.");
  }
  return k;
}

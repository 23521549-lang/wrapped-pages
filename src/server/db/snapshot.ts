import { is } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import type { AnyDb } from "./types";

/**
 * Chay cac truy van doc tren cung mot anh chup database: moi cau lenh ben trong thay cung mot du lieu, ke ca khi
 * mot giao dich khac commit giua chung. Moi ham doc gop nhieu bang de quyet to nao che, to nao mo phai
 * doc qua day. Chi doc: giao dich chi doc o muc repeatable read khong bao gio loi serialization.
 * Nhan mot giao dich dang chay thi nem loi: drizzle bien giao dich long nhau thanh savepoint va bo qua cau hinh,
 * nen se lang le chay o read committed va mat anh chup.
 */
export function readSnapshot<T>(db: AnyDb, fn: (tx: AnyDb) => Promise<T>): Promise<T> {
  if (is(db, PgTransaction)) throw new Error("readSnapshot can db goc, khong nhan mot giao dich dang chay");
  return db.transaction((tx) => fn(tx), { isolationLevel: "repeatable read", accessMode: "read only" });
}

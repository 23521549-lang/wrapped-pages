import { getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "@/server/db/schema";
import { e2eUrls } from "./env";
import { rethrowSafely } from "./safe-error";

// Danh sach bang lay tu schema, giong het cach tests/helpers/db.ts lam - khong viet tay (bat bien 4).
const BANG = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));

/** Cac ma loi SQLSTATE cua Postgres dang "cho mot chut roi lam lai thi qua": tranh chap khoa thuan tuy. */
const MA_THU_LAI = new Set(["40P01", "55P03", "40001"]);

/**
 * Cho khoa toi da bang nay roi bo cuoc. Dat NGAN hon deadlock_timeout mac dinh cua Postgres (1s):
 * neu co ai do dang giu khoa, reset nhan 55P03 va tu thu lai, thay vi cho toi luc Postgres phai
 * chon mot ben lam vat te - ma ben bi chon rat co the la truy van cua may chu app, khong phai ta.
 */
const CHO_KHOA_MS = 900;
/** Tran cung cho vong thu lai: het so lan nay thi nem loi ro rang, khong bao gio treo bo test. */
const SO_LAN_THU = 4;
/** Nghi giua hai lan thu (nhan dan theo so lan da thu) de hai ben khong lao vao nhau lan nua. */
const NGHI_MS = 120;

/**
 * Thu tu xoa suy tu chinh khoa ngoai trong schema, khong viet tay (bat bien 4): mot bang chi duoc
 * xoa khi khong con bang CHUA xoa nao tro khoa ngoai toi no - con truoc, cha sau. Nho vay `delete`
 * khong can `cascade` va van dung ke ca khi mai nay co khoa ngoai `no action`.
 *
 * `books` va `media` tro vong lai nhau (bia sach tu tai len), nen den luc chi con cum vong tron thi
 * khong bang nao "tu do" ca; khi do lay bang bi it bang khac tro toi nhat. Hai chieu cua vong tron
 * hien tai deu la `on delete cascade`/`set null` nen xoa theo chieu nao cung sach.
 */
function thuTuXoa(bang: PgTable[]): string[] {
  const chaCua = new Map<string, Set<string>>();
  for (const t of bang) {
    const ten = getTableName(t);
    const cha = new Set<string>();
    for (const fk of getTableConfig(t).foreignKeys) {
      const toi = getTableName(fk.reference().foreignTable);
      if (toi !== ten) cha.add(toi);
    }
    chaCua.set(ten, cha);
  }

  const conLai = bang.map((t) => getTableName(t));
  const demTroToi = (ten: string) => conLai.filter((khac) => khac !== ten && chaCua.get(khac)?.has(ten) === true).length;

  const thuTu: string[] = [];
  while (conLai.length > 0) {
    const tuDo = conLai.filter((ten) => demTroToi(ten) === 0);
    const lot = tuDo.length > 0 ? tuDo : [conLai.reduce((a, b) => (demTroToi(b) < demTroToi(a) ? b : a))];
    for (const ten of lot) {
      thuTu.push(ten);
      conLai.splice(conLai.indexOf(ten), 1);
    }
  }
  return thuTu;
}

/**
 * Cau lenh xoa sach du lieu, gui trong DUNG MOT luot di ve.
 *
 * Dung `delete` chu khong phai `truncate`: `truncate` lay khoa ACCESS EXCLUSIVE tren tung bang mot,
 * dung loai khoa dung do ca mot `select` tam thuong cung, nen no dam thang vao pool ket noi cua may
 * chu Next dang song suot ca bo test - hai ben lay khoa theo hai thu tu khac nhau va Postgres bao
 * deadlock (40P01). `delete` chi lay ROW EXCLUSIVE, khong dung do voi select/insert/update/delete
 * cua app, nen cho dung do o muc bang bien mat han. Du lieu e2e chi vai chuc hang nen `delete` cung
 * nhanh nhu nhau, va schema khong co mot sequence/serial nao nen `restart identity` von la lenh rong.
 */
export const CAU_LENH_XOA = [
  `set lock_timeout = '${CHO_KHOA_MS}ms'`,
  ...thuTuXoa(BANG).map((ten) => `delete from "${ten}"`),
].join(";\n");

/**
 * Rao cua resetDb: chi cho qua khi dang thuc su noi vao database mqce_e2e.
 * Tach rieng khoi ket noi that de kiem duoc rao nay ma khong can cham toi database nao ca.
 */
export function assertE2eDatabase(name: string): void {
  if (name !== "mqce_e2e") {
    throw new Error(`resetDb tu choi: dang noi vao "${name}", khong phai mqce_e2e`);
  }
}

/**
 * Mot lan ket noi de reset. Tach khoi postgres.js de kiem duoc vong thu lai bang mot ban gia,
 * khong can database that.
 */
export interface PhienReset {
  tenDatabase(): Promise<string>;
  xoaSach(): Promise<void>;
  dong(): Promise<void>;
}

type KetQua = { xong: true } | { xong: false; loi: unknown };

/** Mot lan thu: mo phien moi, kiem rao, xoa, dong phien du thanh hay bai. */
async function motLan(moPhien: () => PhienReset): Promise<KetQua> {
  const phien = moPhien();
  try {
    // Rao chay LAI o moi lan thu, truoc bat ky cau lenh xoa nao.
    assertE2eDatabase(await phien.tenDatabase());
    await phien.xoaSach();
    return { xong: true };
  } catch (loi) {
    return { xong: false, loi };
  } finally {
    await phien.dong();
  }
}

function maLoi(loi: unknown): string | undefined {
  const ma = (loi as { code?: unknown } | null)?.code;
  return typeof ma === "string" ? ma : undefined;
}

/**
 * Vong thu lai co tran cho reset (bat bien 5 giu nguyen: khong loi nao keo theo chuoi ket noi).
 * Chi thu lai dung cac ma tranh chap khoa; moi loi khac nem ngay nhu cu, va het luot thi nem mot
 * loi noi ro da thu bao nhieu lan - khong bao gio thu vo han.
 */
export async function chayReset(
  moPhien: () => PhienReset,
  { soLan = SO_LAN_THU, nghiMs = NGHI_MS }: { soLan?: number; nghiMs?: number } = {},
): Promise<void> {
  let maCuoi = "";
  for (let lan = 1; lan <= soLan; lan++) {
    if (lan > 1) await new Promise((tiep) => { setTimeout(tiep, nghiMs * (lan - 1)); });

    const ketQua = await motLan(moPhien);
    if (ketQua.xong) return;

    const { loi } = ketQua;
    if (loi instanceof Error && loi.message.startsWith("resetDb tu choi")) throw loi;
    const ma = maLoi(loi);
    if (ma === undefined || !MA_THU_LAI.has(ma)) rethrowSafely(loi);
    maCuoi = ma;
  }
  throw Object.assign(
    new Error(`resetDb bo cuoc sau ${soLan} lan thu vi tranh chap khoa (ma ${maCuoi})`),
    { code: maCuoi },
  );
}

function phienPostgres(e2eUrl: string): PhienReset {
  // onnotice tat NOTICE cua Postgres de output sach.
  const sql = postgres(e2eUrl, { max: 1, onnotice: () => {} });
  return {
    async tenDatabase() {
      const rows = await sql<{ name: string }[]>`select current_database() as name`;
      return rows[0].name;
    },
    async xoaSach() {
      // `.simple()`: nhieu cau lenh trong MOT luot di ve. Postgres boc ca chuoi trong mot giao dich
      // ngam (chuoi nay khong co begin/commit tuong minh), nen hoac sach het, hoac khong doi gi -
      // va loi giua chung khong bao gio de ket noi ket lai trong trang thai giao dich hong.
      await sql.unsafe(CAU_LENH_XOA).simple();
    },
    async dong() {
      await sql.end().catch(() => {});
    },
  };
}

/**
 * Xoa sach du lieu database e2e truoc moi test (chi chay tren database mqce_e2e).
 * Ket noi rieng cho tung lan thu, dong lai sau moi lan.
 */
export async function resetDb(): Promise<void> {
  const { e2eUrl } = e2eUrls();
  await chayReset(() => phienPostgres(e2eUrl));
}

import { describe, it, expect } from "vitest";
import { getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@/server/db/schema";
import { CAU_LENH_XOA, assertE2eDatabase, chayReset, type PhienReset } from "../e2e/db";

/**
 * Vong thu lai cua resetDb (tests/e2e/db.ts). Kiem bang ban gia nen khong cham toi database nao:
 * dieu dang kiem la "tranh chap khoa thi thu lai, nhung co tran, va rao mqce_e2e chay lai moi lan",
 * chu khong phai cau lenh SQL - phan SQL do chinh bo e2e chay that.
 */

/** Loi cua postgres.js la mot Error mang them `code` = ma SQLSTATE, cong vai truong noi bo. */
function loiSql(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, query: "delete from \"accounts\"" });
}

interface NhatKy {
  ten: string[];
  xoa: number;
  dong: number;
}

/** `loiXoa(lan)` quyet dinh lan thu thu `lan` hong hay xuoi. Moi lan thu mo mot phien moi. */
function banGia(loiXoa: (lan: number) => Error | undefined, ten = "mqce_e2e") {
  const nhat: NhatKy = { ten: [], xoa: 0, dong: 0 };
  let daMo = 0;
  const moPhien = (): PhienReset => {
    daMo += 1;
    const lan = daMo;
    return {
      tenDatabase() {
        nhat.ten.push(ten);
        return Promise.resolve(ten);
      },
      xoaSach() {
        nhat.xoa += 1;
        const loi = loiXoa(lan);
        return loi === undefined ? Promise.resolve() : Promise.reject(loi);
      },
      dong() {
        nhat.dong += 1;
        return Promise.resolve();
      },
    };
  };
  return { nhat, moPhien };
}

const KHONG_NGHI = { nghiMs: 0 };

describe("chayReset", () => {
  it("deadlock o lan dau thi thu lai va lan sau di qua", async () => {
    const { nhat, moPhien } = banGia((lan) => (lan === 1 ? loiSql("40P01", "deadlock detected") : undefined));

    await expect(chayReset(moPhien, KHONG_NGHI)).resolves.toBeUndefined();

    // Neu bo vong thu lai, xoa se dung o 1 va ca lot test se do ngay tai day.
    expect(nhat.xoa, "phai thu lai lan hai sau khi Postgres bao deadlock").toBe(2);
    // Rao database chay LAI o moi lan thu, truoc moi cau lenh xoa.
    expect(nhat.ten).toEqual(["mqce_e2e", "mqce_e2e"]);
    // Phien nao mo ra cung duoc dong lai, ke ca phien hong.
    expect(nhat.dong).toBe(2);
  });

  it("het khoa (55P03) cung la loi thu lai duoc", async () => {
    const { nhat, moPhien } = banGia((lan) => (lan === 1 ? loiSql("55P03", "canceling statement due to lock timeout") : undefined));

    await expect(chayReset(moPhien, KHONG_NGHI)).resolves.toBeUndefined();
    expect(nhat.xoa).toBe(2);
  });

  it("thu lai co tran: het so lan thi nem loi noi ro, khong thu mai", async () => {
    const { nhat, moPhien } = banGia(() => loiSql("40P01", "deadlock detected"));

    const loi = await chayReset(moPhien, { ...KHONG_NGHI, soLan: 3 }).then(() => null, (e: unknown) => e);

    expect(nhat.xoa, "phai dung dung o so lan da dat").toBe(3);
    expect((loi as Error).message).toContain("bo cuoc sau 3 lan thu");
    expect((loi as { code?: string }).code).toBe("40P01");
    // Bat bien 5: loi nem ra la Error tron, khong keo theo truong noi bo nao cua postgres.js.
    expect((loi as { query?: unknown }).query).toBeUndefined();
  });

  it("loi khong phai tranh chap khoa thi nem ngay, khong thu lai", async () => {
    const { nhat, moPhien } = banGia(() => loiSql("23505", "duplicate key value violates unique constraint"));

    const loi = await chayReset(moPhien, KHONG_NGHI).then(() => null, (e: unknown) => e);

    expect(nhat.xoa).toBe(1);
    expect((loi as Error).message).toContain("duplicate key value");
    expect((loi as { code?: string }).code).toBe("23505");
    expect((loi as { query?: unknown }).query, "bat bien 5: khong keo theo truong noi bo").toBeUndefined();
  });

  it("noi nham database thi tu choi truoc khi xoa bat cu thu gi", async () => {
    const { nhat, moPhien } = banGia(() => undefined, "mqce");

    const loi = await chayReset(moPhien, KHONG_NGHI).then(() => null, (e: unknown) => e);

    expect((loi as Error).message).toContain("resetDb tu choi");
    expect(nhat.xoa, "khong duoc chay cau lenh xoa nao").toBe(0);
    expect(nhat.ten, "khong thu lai rao sai database").toHaveLength(1);
    expect(nhat.dong).toBe(1);
  });

  it("assertE2eDatabase van chi cho qua dung mqce_e2e", () => {
    expect(() => { assertE2eDatabase("mqce_e2e"); }).not.toThrow();
    expect(() => { assertE2eDatabase("mqce"); }).toThrow(/resetDb tu choi/);
    expect(() => { assertE2eDatabase("postgres"); }).toThrow(/resetDb tu choi/);
  });
});

describe("CAU_LENH_XOA", () => {
  const cauLenh = CAU_LENH_XOA.split(";\n");
  const bang = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));
  const viTri = new Map<string, number>();
  for (const [i, c] of cauLenh.entries()) {
    const khop = /^delete from "(.+)"$/.exec(c);
    if (khop !== null) viTri.set(khop[1], i);
  }

  it("dat lock_timeout truoc roi moi xoa", () => {
    expect(cauLenh[0]).toMatch(/^set lock_timeout = '\d+ms'$/);
  });

  it("xoa dung moi bang cua schema, khong thua khong thieu (bat bien 4)", () => {
    expect([...viTri.keys()].sort()).toEqual(bang.map((t) => getTableName(t)).sort());
    expect(cauLenh).toHaveLength(bang.length + 1);
  });

  it("xoa con truoc cha, tru cap tro vong lai nhau", () => {
    for (const t of bang) {
      const ten = getTableName(t);
      for (const fk of getTableConfig(t).foreignKeys) {
        const cha = getTableName(fk.reference().foreignTable);
        if (cha === ten) continue;
        // Cap tro vong lai nhau (books <-> media) thi khong the xep chieu nao cung dung; ca hai
        // chieu deu la cascade/set null nen xoa sao cung sach.
        const voLai = getTableConfig(fk.reference().foreignTable).foreignKeys
          .some((n) => getTableName(n.reference().foreignTable) === ten);
        if (voLai) continue;
        expect(viTri.get(ten), `${ten} phai bi xoa truoc ${cha}`).toBeLessThan(viTri.get(cha) ?? -1);
      }
    }
  });
});

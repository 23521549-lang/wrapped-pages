import { spawn, type ChildProcess } from "node:child_process";

/**
 * Mot may chu thu hai dung CHINH ban build ma webServer cua playwright.config.ts vua dung (.next), nhung tro
 * DATABASE_URL toi mot cong khong co gi lang nghe: moi trang cham database se nem loi ket noi, dung tinh huong
 * "database khong toi duoc" ma src/app/error.tsx sinh ra de do. Khong co duong tat nao trong code phat hanh:
 * loi la loi that cua driver postgres, trang la trang that.
 *
 * Bien moi truong cua tien trinh dung truoc .env.local (Next khong ghi de bien da co), nen cac bien khac
 * (SERVER_KEY...) van lay tu .env.local nhu may chu chinh; test khong doc tep do.
 */
export const CONG_MAY_HONG = 3101;
export const GOC_MAY_HONG = `http://localhost:${CONG_MAY_HONG}`;
/** Cong 1 tren may nay khong co dich vu nao: ket noi bi tu choi ngay. Tai khoan va ten database la gia. */
const DATABASE_KHONG_TOI_DUOC = "postgres://khong:khong@127.0.0.1:1/khong_co";

export type MayHong = { dung: () => Promise<void> };

export async function batMayHong(): Promise<MayHong> {
  // NODE_ENV cua tien trinh test (neu co) khong duoc lot sang: ban build nay la ban phat hanh.
  const env = { ...process.env, NODE_ENV: "production" as const, DATABASE_URL: DATABASE_KHONG_TOI_DUOC };
  const tienTrinh: ChildProcess = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", String(CONG_MAY_HONG)],
    { env, stdio: "ignore" },
  );
  const dung = async () => {
    if (tienTrinh.exitCode !== null) return;
    const daThoat = new Promise<void>((xong) => tienTrinh.once("exit", () => xong()));
    tienTrinh.kill();
    await daThoat;
  };
  // /cho khong cham database nen tra 200 ngay ca khi database khong toi duoc: moc san sang.
  const hetHan = Date.now() + 60_000;
  while (Date.now() < hetHan) {
    if (tienTrinh.exitCode !== null) throw new Error(`may chu thu hai thoat som, ma ${tienTrinh.exitCode}`);
    try {
      if ((await fetch(`${GOC_MAY_HONG}/cho`)).ok) return { dung };
    } catch {
      // chua lang nghe, thu lai
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  await dung();
  throw new Error("may chu thu hai khong san sang sau 60 giay");
}

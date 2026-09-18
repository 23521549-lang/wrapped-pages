// Lenh sao luu va khoi phuc database: npm run db:backup, npm run db:restore -- <tep> --xac-nhan.
// Chi la lop vo mong: moi logic nam o src/server/backup/sao-luu.ts (co test). Node 22 tu bo kieu
// cua file .ts nen chay thang duoc, khong can bien dich.
// Khong bao gio in DATABASE_URL hay bat ky gia tri bi mat nao: loi la cua ta thi in thong diep,
// loi khac (ket noi, driver) chi in ma loi, vi thong diep cua driver co the keo theo ten may chu.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  LoiSaoLuu, docTepSaoLuu, docThamSoKhoiPhuc, khoiPhuc, kiemCsdlSaoLuu, saoLuuRaTep, thuMucSaoLuu, tuPostgres,
} from "../src/server/backup/sao-luu.ts";

const THU_MUC_DU_AN = fileURLToPath(new URL("..", import.meta.url));

// Luon nap .env.local neu co: process.loadEnvFile khong de bien da co san trong moi truong (da thu tren
// Node 22.20), nen bien moi truong van thang, con BACKUP_DIR chi dat trong .env.local van duoc doc
// ke ca khi DATABASE_URL da co san trong moi truong.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function inSoHang(soHang) {
  const tong = Object.values(soHang).reduce((a, b) => a + b, 0);
  for (const [ten, n] of Object.entries(soHang)) console.log(`  ${ten.padEnd(16)} ${n}`);
  console.log(`  ${"tổng".padEnd(16)} ${tong}`);
}

async function chay(lenh, thamSo) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new LoiSaoLuu("Thiếu DATABASE_URL (đặt trong .env.local hoặc biến môi trường).");

  if (lenh === "sao-luu") {
    const thuMuc = thuMucSaoLuu(process.env, THU_MUC_DU_AN);
    const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
    try {
      const [{ ten }] = await sql`select current_database() as ten`;
      kiemCsdlSaoLuu(ten);
      console.log(`Đang sao lưu database "${ten}"...`);
      const { duongDan, soHang } = await saoLuuRaTep(tuPostgres(sql), thuMuc);
      console.log(`Đã sao lưu xong vào: ${duongDan}`);
      inSoHang(soHang);
      console.log("Tệp này chứa toàn bộ nhật ký. Cất giữ cẩn thận như SERVER_KEY (xem docs/huong-dan-sao-luu.md).");
    } finally {
      await sql.end().catch(() => {});
    }
    return;
  }

  if (lenh === "khoi-phuc") {
    const { tep } = docThamSoKhoiPhuc(thamSo);
    const ban = await docTepSaoLuu(tep);
    const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
    try {
      const [{ ten }] = await sql`select current_database() as ten`;
      console.log(`Đang khôi phục bản sao lưu lúc ${ban.taoLuc} vào database "${ten}"...`);
      const soHang = await khoiPhuc(tuPostgres(sql), ban);
      console.log("Đã khôi phục xong. Số hàng từng bảng:");
      inSoHang(soHang);
    } finally {
      await sql.end().catch(() => {});
    }
    return;
  }

  throw new LoiSaoLuu("Cách dùng: npm run db:backup, hoặc npm run db:restore -- <tệp> --xac-nhan");
}

try {
  await chay(process.argv[2], process.argv.slice(3));
} catch (loi) {
  if (loi instanceof LoiSaoLuu) {
    console.error(loi.message);
  } else {
    const ma = typeof loi?.code === "string" ? ` (mã ${loi.code})` : "";
    console.error(`Lỗi khi làm việc với database hoặc tệp${ma}. Không có gì bị ghi dở: mọi thao tác chạy trong một giao dịch.`);
  }
  process.exitCode = 1;
}

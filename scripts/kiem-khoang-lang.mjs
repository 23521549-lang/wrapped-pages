#!/usr/bin/env node
// Cong CI Khoang Lang: bat loader doc bang chua noi dung theo nguoi ma khong loc.
// Chay: node scripts/kiem-khoang-lang.mjs [--root <thu-muc-repo>] [--ngoai-le <file-json>]
// Exit 0 = pass, 1 = co vi pham hoac file ngoai le sai dinh dang.
//
// Pham vi quet (hep, chong bao sai): src/server/**, src/app/**/page.tsx, src/app/actions/**.
// Bang chua noi dung theo nguoi (ca ten snake_case trong DB va ten camelCase cua drizzle):
// activity, rounds, moods, cam_xuc/camXuc, thu_thang/thuThang, de_nghi/deNghi,
// seal_replies/sealReplies, round_replies/roundReplies, seal_attempts/sealAttempts.
//
// Luat: file cham mot bang tren ma KHONG thoa bat cu dieu nao sau thi FAIL, in dung file + dong:
//   1. import helper loc tu "@/server/khoang-lang/loc", HOAC
//   2. tham chieu co `khoangLang` (loc bang tham so co truyen tu Me), HOAC
//   3. nam trong scripts/khoang-lang-ngoai-le.json (moi muc co file, lyDo, nguoiDuyet).
//
// GHI CHU (lech khoi chu plan §4.1, ghi ro de review): plan viet luat 1 la
// "KHONG import tu loc.ts thi fail". Nhung task 2 chi dao loader loc duoc trong SQL
// thi them dieu kien SQL thay vi goi helper, nen thuc te KHONG loader nao import
// helper — tat ca loc bang tham so co `khoangLang`. Neu giu luat chu thi moi loader
// deu phai vao ngoai le, danh sach ngoai le mat y nghia. Nen cong chap nhan tham
// chieu `khoangLang` nhu tin hieu loc (dieu 2), va danh sach ngoai le chi giu file
// that su KHONG CAN loc (chi doc dong cua minh, chi ghi, dinh nghia bang).
// De doi lai luat chu chi can sua ham `duocPhep` o duoi.
//
// Cach quet: bo dong import (duong dan module chua ten bang gay bao sai) va bo
// comment (ten bang trong comment khong phai cau lenh) roi khop ten bang nguyen tu.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const BANG = [
  ["activity", "activity"],
  ["rounds", "rounds"],
  ["moods", "moods"],
  ["cam_xuc", "camXuc"],
  ["thu_thang", "thuThang"],
  ["de_nghi", "deNghi"],
  ["seal_replies", "sealReplies"],
  ["round_replies", "roundReplies"],
  ["seal_attempts", "sealAttempts"],
];

const TEN_BANG = new Set(BANG.flat());

function docThamSo(argv) {
  const kq = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root" && argv[i + 1]) kq.root = argv[i + 1];
    if (argv[i] === "--ngoai-le" && argv[i + 1]) kq.ngoaiLe = argv[i + 1];
  }
  return kq;
}

function lietKeFile(thuMuc, goc, ra = []) {
  for (const muc of readdirSync(thuMuc, { withFileTypes: true })) {
    const duong = join(thuMuc, muc.name);
    if (muc.isDirectory()) {
      lietKeFile(duong, goc, ra);
    } else if (muc.isFile() && /\.(ts|tsx)$/.test(muc.name)) {
      ra.push(relative(goc, duong).split(sep).join("/"));
    }
  }
  return ra;
}

function fileTrongPhamVi(root) {
  const ra = [];
  const server = join(root, "src/server");
  if (existsSync(server)) ra.push(...lietKeFile(server, root));
  const app = join(root, "src/app");
  if (existsSync(app)) {
    const tatCa = lietKeFile(app, root);
    for (const f of tatCa) {
      if (f.endsWith("/page.tsx") || f.startsWith("src/app/actions/")) ra.push(f);
    }
  }
  return ra.toSorted();
}

// Cat comment khoi va comment dong, tra ve tung dong da sach (giu nguyen so dong).
function sachDong(noiDung) {
  const dong = noiDung.split("\n");
  const ra = [];
  let trongKhoi = false;
  for (let d of dong) {
    let s = d;
    if (trongKhoi) {
      const het = s.indexOf("*/");
      if (het === -1) {
        ra.push("");
        continue;
      }
      s = s.slice(het + 2);
      trongKhoi = false;
    }
    for (;;) {
      const batDau = s.indexOf("/*");
      if (batDau === -1) break;
      const het = s.indexOf("*/", batDau + 2);
      if (het === -1) {
        s = s.slice(0, batDau);
        trongKhoi = true;
        break;
      }
      s = s.slice(0, batDau) + " " + s.slice(het + 2);
    }
    const gach = s.indexOf("//");
    if (gach !== -1) s = s.slice(0, gach);
    ra.push(s);
  }
  return ra;
}

function bangBiCham(dongSach) {
  const viPham = [];
  dongSach.forEach((d, i) => {
    if (/^\s*import\s/.test(d)) return;
    for (const ten of TEN_BANG) {
      if (new RegExp(`\\b${ten}\\b`).test(d)) {
        viPham.push({ dong: i + 1, bang: ten });
      }
    }
  });
  return viPham;
}

function docNgoaiLe(duong) {
  if (!existsSync(duong)) {
    return { loi: `khong tim thay file ngoai le: ${duong}` };
  }
  let duLieu;
  try {
    duLieu = JSON.parse(readFileSync(duong, "utf8"));
  } catch (e) {
    return { loi: `file ngoai le khong phai JSON hop le: ${e.message}` };
  }
  if (!duLieu || !Array.isArray(duLieu.ngoaiLe)) {
    return { loi: "file ngoai le phai co mang \"ngoaiLe\"" };
  }
  const danhSach = new Map();
  for (const muc of duLieu.ngoaiLe) {
    for (const truong of ["file", "lyDo", "nguoiDuyet"]) {
      if (!muc || typeof muc[truong] !== "string" || muc[truong].trim() === "") {
        return {
          loi: `muc ngoai le thieu truong "${truong}": ${JSON.stringify(muc)}`,
        };
      }
    }
    danhSach.set(muc.file, muc);
  }
  return { danhSach };
}

function main() {
  const thuMucScript = dirname(fileURLToPath(import.meta.url));
  const thamSo = docThamSo(process.argv.slice(2));
  const root = resolve(thamSo.root ?? join(thuMucScript, ".."));
  const fileNgoaiLe = resolve(
    thamSo.ngoaiLe ?? join(root, "scripts/khoang-lang-ngoai-le.json"),
  );
  const { danhSach, loi } = docNgoaiLe(fileNgoaiLe);
  if (loi) {
    console.error(`FAIL: ${loi}`);
    process.exit(1);
  }
  const files = fileTrongPhamVi(root);
  const viPham = [];
  let soChamBang = 0;
  for (const file of files) {
    const noiDung = readFileSync(join(root, file), "utf8");
    const dongSach = sachDong(noiDung);
    const cham = bangBiCham(dongSach);
    if (cham.length === 0) continue;
    soChamBang += 1;
    const quaHelper = /from\s+["']@\/server\/khoang-lang\/loc["']/.test(noiDung);
    const quaCo = /\bkhoangLang\b/.test(dongSach.join("\n"));
    const ngoaiLe = danhSach.has(file);
    if (quaHelper || quaCo || ngoaiLe) continue;
    for (const c of cham) {
      viPham.push(`${file}:${c.dong}: cham bang ${c.bang} ma khong qua helper/co/ngoai le`);
    }
  }
  for (const [file] of danhSach) {
    if (!existsSync(join(root, file))) {
      console.error(`CANH BAO: muc ngoai le khong con file: ${file}`);
    }
  }
  if (viPham.length > 0) {
    for (const v of viPham) console.log(`FAIL: ${v}`);
    console.log(
      `FAIL: ${viPham.length} vi pham trong ${files.length} file da quet (${soChamBang} file cham bang)`,
    );
    process.exit(1);
  }
  console.log(
    `OK: da quet ${files.length} file, ${soChamBang} file cham bang, khong vi pham`,
  );
}

main();

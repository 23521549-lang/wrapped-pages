import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";

/*
 * Cong do dai tieu de: tieu de TINH viet thang trong JSX toi da 20 ky tu. Tieu de
 * sinh tu chu nguoi dung (vd ten sach) khong thuoc pham vi nay - da co tran rieng o buoc kiem dau vao va
 * bao loi ngay tai o nhap (xem sach/moi, cai-dat).
 *
 * Cach doc: duyet moi .tsx trong src, tim tung cap the <h1>/<h2>/<h3>...</h1|2|3>, lay phan NOI DUNG (giua
 * dau > cua the mo va dau < cua the dong, khong tinh thuoc tinh nhu id={...}). Dau ">" ket thuc the mo
 * KHONG tim bang indexOf(">") don gian: mot thuoc tinh mang bieu thuc JSX co the tu chua ">" ma khong phai
 * dau dong the (vd `onClick={() => lam()}` co ">" trong "=>"), lam indexOf don gian cat nham the mo giua
 * bieu thuc va bien phan con lai thanh "tieu de" - mot loi doc SAI AM THAM, khac voi cac truong hop bo qua
 * co chu dich duoi day vi no khong bo qua ma bao "dat" tren mot chuoi chua bao gio duoc kiem that. Duoc xu
 * ly TRIET DE (khong phai bo qua) bang timDauDongTheMo: quet tung ky tu, dem do sau "{...}" va theo doi co
 * dang trong chuoi thuoc tinh ("..."/'...'/`...`) hay khong, chi coi ">" la dau dong the khi do sau ngoac
 * bang 0 va khong dang trong chuoi. Xem test rieng cho truong hop nay ("khong bi dau > trong thuoc tinh...").
 *
 * BO QUA CO CHU DICH (khong am tham):
 *  - Chu hien thi (sau khi bo the con, xem duoi) chua `{`: tieu de dong (bien, template string, bieu thuc
 *    dieu kien...). Luat 20 ky tu chi ap cho tieu de tinh, tieu de dong khong thuoc pham vi nay.
 *  - The tu dong (vd <h2 ... />): khong co noi dung de doc do dai, va h1/h2/h3 tu dong khong mang y nghia
 *    trong HTML (tieu de rong). Hien khong co the nao nhu vay trong src.
 *  - Noi dung chua thuc the HTML (vd &amp;, &nbsp;): giai ma thuc the dung dan la viec khac, va hien khong
 *    co tieu de tinh nao dung thuc the trong src. Neu xuat hien, phai giai ma truoc khi dem ky tu.
 *  - The mo/dong nam tren nhieu dong (vd thuoc tinh xuong dong): bai kiem doc theo tung KHOI ma tu dau <hN
 *    den het </hN> tuong ung (khong theo tung dong), nen truong hop nay THUC RA duoc bat binh thuong, ghi
 *    ro o day de neu sau nay co ai doi cach doc thi biet day khong con la truong hop rieng nua.
 *
 * THE CON LONG BEN TRONG (vd <h2>Loi nhan <em>cua ban</em></h2>) KHONG bo qua: boTheCon bo ma the (quet
 * bang timDauDongTheMo, nen thuoc tinh co ">" hay "{...}" cung khong danh lua), con lai chu hien thi, roi
 * moi xet dong/tinh va dem. Khong tach duoc the con (the khong dong) thi bao loi va bai kiem do, khong bo
 * qua. Khoang trang duoc gom nhu JSX hien thi (xuong dong va thut dau dong khong phai chu).
 *
 * Dem ky tu "nhu nguoi doc dem": dung Intl.Segmenter (grapheme) thay vi String#length. Chu Tieng Viet co
 * the o dang dung san (NFC, mot ma diem cho moi chu, vd "a" = U+1EBF) hoac dang tach roi (NFD, chu goc +
 * dau ghep, nhieu ma diem). String#length dem theo don vi UTF-16 nen se dem MOT chu NFD la nhieu ky tu du
 * mat nguoi doc chi thay mot chu. Intl.Segmenter dem theo cum-hien-thi (grapheme cluster) nen cho cung mot
 * ket qua o ca hai dang, khop voi cam nhan cua nguoi doc.
 */

const THU_MUC = "src";
const GIOI_HAN = 20;
const dem = new Intl.Segmenter("vi", { granularity: "grapheme" });
function demKyTu(s: string): number {
  return [...dem.segment(s)].length;
}

/** Moi file .tsx trong src, duong dan dung "/" de doc duoc tren moi he dieu hanh. */
function tsxFiles(): string[] {
  return (readdirSync(THU_MUC, { recursive: true }) as string[])
    .map((p) => `${THU_MUC}/${p.split(sep).join("/")}`)
    .filter((p) => p.endsWith(".tsx"));
}

interface TieuDe {
  file: string;
  text: string;
}

/** Tim vi tri dau ">" THUC SU ket thuc the mo, tinh tu chi so bat dau (ngay sau "<hN"). Khong dung
 *  indexOf(">") don gian: mot thuoc tinh mang bieu thuc JSX co the chua ">" ma khong phai dau dong the (vd
 *  `onClick={() => lam()}` co ">" trong "=>"), va indexOf don gian se bi danh lua, cat nham the mo o giua
 *  bieu thuc roi bien phan con lai cua bieu thuc do thanh "noi dung tieu de" - MOT LOI DOC SAI AM THAM,
 *  khong phai bo qua co chu dich, vi no bao "dat" tren mot chuoi chua bao gio duoc kiem that. Ham nay quet
 *  tung ky tu, dem do sau "{...}" va theo doi co dang trong chuoi ("..."/'...'/`...`) hay khong: ">" chi
 *  duoc coi la dau dong the khi do sau ngoac bang 0 VA khong dang trong chuoi. Neu quet het chuoi ma van
 *  con dang trong ngoac hoac trong chuoi do (khong ket duoc), tra ve -1 - coi la loi cu phap, khong phai
 *  viec bai kiem nay xu ly (giu nguyen quy uoc cu cho truong hop the khong dong). */
function timDauDongTheMo(noiDung: string, tuViTri: number): number {
  let doSauNgoac = 0;
  let trongChuoi: string | null = null;
  for (let i = tuViTri; i < noiDung.length; i++) {
    const c = noiDung[i];
    if (trongChuoi !== null) {
      if (c === "\\") { i++; continue; } // ky tu thoat: bo qua ky tu ke tiep, khong xet la dau dong chuoi
      if (c === trongChuoi) trongChuoi = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") trongChuoi = c;
    else if (c === "{") doSauNgoac++;
    else if (c === "}") doSauNgoac = Math.max(0, doSauNgoac - 1);
    else if (c === ">" && doSauNgoac === 0) return i;
  }
  return -1;
}

/** Chu hien thi cua noi dung mot the: bo moi the con (mo, dong, tu dong), gom khoang trang. Tra null neu mot
 *  the con khong dong duoc (loi doc: noi goi phai bao ra, khong duoc bo qua). */
function boTheCon(noiDungThe: string): string | null {
  let ra = "";
  let i = 0;
  while (i < noiDungThe.length) {
    const mo = noiDungThe.indexOf("<", i);
    // Mot bieu thuc JSX {...} o phan chu (khong nam trong the con) thi tieu de la dong. Tra nguyen noi dung (co
    // chua "{") de noi goi bo qua dung ly do, truoc khi mot dau < ben trong bieu thuc bi doc nham la the con.
    const ngoac = noiDungThe.indexOf("{", i);
    if (ngoac !== -1 && (mo === -1 || ngoac < mo)) return noiDungThe;
    if (mo === -1) {
      ra += noiDungThe.slice(i);
      break;
    }
    ra += noiDungThe.slice(i, mo);
    const dong = timDauDongTheMo(noiDungThe, mo + 1);
    if (dong === -1) return null;
    i = dong + 1;
  }
  return ra.replace(/\s+/g, " ").trim();
}

/** Tim moi cap <hN ...>NOI DUNG</hN> (N = 1|2|3) trong mot file, doc theo KHOI (tu dau the mo den het the
 *  dong tuong ung), khong theo tung dong, nen the trai dai nhieu dong van duoc bat. Bo qua (khong dua vao
 *  ket qua) nhung truong hop bo qua co chu dich (xem comment dau file): the tu dong, noi dung dong ({...}).
 *  The con long ben trong thi bo ma the roi do chu hien thi; khong tach duoc thi day vao loiDoc. */
function timTieuDeTinh(file: string, noiDung: string, loiDoc: string[] = []): TieuDe[] {
  const ketQua: TieuDe[] = [];
  const moThe = /<h([123])\b/g;
  let m: RegExpExecArray | null;
  while ((m = moThe.exec(noiDung)) !== null) {
    const cap = m[1];
    const dongMo = timDauDongTheMo(noiDung, moThe.lastIndex);
    if (dongMo === -1) break; // the mo khong dong: file loi cu phap, khong phai viec bai kiem nay xu ly
    const tuDongDong = noiDung[dongMo - 1] === "/";
    if (tuDongDong) {
      moThe.lastIndex = dongMo + 1;
      continue; // the tu dong: khong co noi dung, bo qua co chu dich (xem comment dau file)
    }
    const theDong = `</h${cap}>`;
    const viTriDong = noiDung.indexOf(theDong, dongMo + 1);
    if (viTriDong === -1) break; // khong tim thay the dong tuong ung: file loi cu phap
    const noiDungThe = noiDung.slice(dongMo + 1, viTriDong);
    moThe.lastIndex = viTriDong + theDong.length;

    const chu = boTheCon(noiDungThe);
    if (chu === null) {
      loiDoc.push(`${file}: tieu de <h${cap}> long the con khong dong, bai kiem chua doc duoc: ${noiDungThe.trim()}`);
      continue;
    }
    if (chu.includes("{")) continue; // tieu de dong: luat 20 ky tu khong ap
    ketQua.push({ file, text: chu });
  }
  return ketQua;
}

function moiTieuDeTinh(): TieuDe[] {
  const ra: TieuDe[] = [];
  const loiDoc: string[] = [];
  for (const file of tsxFiles()) {
    const noiDung = readFileSync(file, "utf8");
    ra.push(...timTieuDeTinh(file, noiDung, loiDoc));
  }
  expect(loiDoc, "tieu de bai kiem khong doc duoc").toEqual([]);
  return ra;
}

describe("cong do dai tieu de tinh: toi da 20 ky tu", () => {
  it("tim duoc tieu de tinh trong src (tu kiem bo do khong bi rong)", () => {
    expect(moiTieuDeTinh().length).toBeGreaterThan(10);
  });

  it("moi tieu de <h1>/<h2>/<h3> tinh trong JSX dai toi da 20 ky tu", () => {
    const qua = moiTieuDeTinh()
      .map((t) => ({ file: t.file, text: t.text, doDai: demKyTu(t.text) }))
      .filter((t) => t.doDai > GIOI_HAN);
    const loi = qua.map((t) => `${t.file}: "${t.text}" dai ${t.doDai} ky tu (toi da ${GIOI_HAN})`);
    expect(loi).toEqual([]);
  });

  it("khong bi dau > trong thuoc tinh (vd bieu thuc mui ten onClick={() => ...}) danh lua dau dong the mo", () => {
    const noiDung = "<h2 onClick={() => lam()}>Tieu de that</h2>";
    expect(timTieuDeTinh("gia.tsx", noiDung)).toEqual([{ file: "gia.tsx", text: "Tieu de that" }]);
  });

  it("tieu de long the con: do chu hien thi, ke ca khi the con co thuoc tinh {...} hay xuong dong", () => {
    expect(timTieuDeTinh("gia.tsx", "<h2>Lời nhắn <em>của bạn</em></h2>")).toEqual([{ file: "gia.tsx", text: "Lời nhắn của bạn" }]);
    expect(timTieuDeTinh("gia.tsx", '<h2 className="d">\n  Chữ <span className={lop} onClick={() => a > b}>tĩnh</span><br />\n</h2>'))
      .toEqual([{ file: "gia.tsx", text: "Chữ tĩnh" }]);
    // Chu hien thi con {...} sau khi bo the con: van la tieu de dong.
    expect(timTieuDeTinh("gia.tsx", "<h2>Chào <b>{ten}</b></h2>")).toEqual([]);
    // Dau < nam trong bieu thuc {...} o phan chu la phep so sanh, khong phai the con: tieu de dong, khong loi doc.
    const loiDoc: string[] = [];
    expect(timTieuDeTinh("gia.tsx", "<h2>{n < 2 ? \"Một trang\" : \"Nhiều trang\"}</h2>", loiDoc)).toEqual([]);
    expect(loiDoc).toEqual([]);
  });

  it("the con khong dong thi bao loi doc, khong lang le bo qua", () => {
    const loiDoc: string[] = [];
    expect(timTieuDeTinh("gia.tsx", '<h2>Chữ <b className={"x"</h2>', loiDoc)).toEqual([]);
    expect(loiDoc).toHaveLength(1);
    expect(loiDoc[0]).toContain("gia.tsx: tieu de <h2> long the con khong dong");
  });
});

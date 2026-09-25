import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import type { Srgb } from "@/lib/mau/oklch";
import { contrastRatio } from "@/lib/mau/tuong-phan";
import { boComment, docBangToken, THU_MUC_CSS } from "../helpers/bang-token";

/*
 * Cong tuong phan that: khong mang danh sach cap viet tay. Mot bang do tay truoc day
 * tung sai chinh vi no la danh sach tay: vien nut --blue-line duoc do tren --color-paper (nen cua trang quanh
 * nut), trong khi .btn dat vien do len chinh nen --blue-2 cua nut, va cap that khong dat nguong. Bai kiem nay
 * suy cap tu chinh CSS:
 *
 *  - Bang mau lay tu moi token `--x: oklch(...)` trong tokens.css.
 *  - Duyet moi tep CSS khac, tach tung khoi quy tac, doc `color`, `background`, `background-color`,
 *    `border-color`, `border` (rut gon, vd `border: 1px solid var(--blue-line)`), bon canh rieng
 *    `border-top/bottom/left/right` (+ dang `-color` cua tung canh), va `outline`/`outline-color`
 *    (vong focus dung chung nguong voi vien: ca hai deu la net khoanh vien, khong phai chu).
 *  - Khoi khai CA mau chu/vien LAN nen: do dung cap do (nen la background hieu dung cua chinh khoi).
 *  - Khoi chi khai mau chu/vien, HOAC nen la `transparent`, mot `color-mix(...)`, hoac bat ky gia tri nao
 *    khac khong quy ve dung MOT token phang (vd linear-gradient nhieu mau): mau hieu dung phu thuoc thu
 *    nam phia sau nen KHONG tinh duoc tu CSS. Khong duoc lang le bo qua (do la cach mot cap lot qua ma
 *    khong ai do), nen do mau/vien do voi CA BA be mat --color-paper, --color-paper-2, --color-paper-3 va
 *    doi dat tren ca ba.
 *  - `color-mix(in oklch, var(--x) P%, transparent)` lam MAU CHU/VIEN (khong chi lam nen) cung khong duoc
 *    bo qua: day la token --x nhung chi phu P% (con lai la trong suot), nen mau hien thi that su la P%
 *    --x tron voi ung vien nen (cung mot hoac ca ba be mat nhu tren). Tron truoc, roi moi do tuong phan
 *    cua ket qua tron voi chinh nen do.
 *  - `box-shadow` cung duoc doc, nhung CHI khi mot lop cua no la mot VONG VIEN thuc su: offset-x va
 *    offset-y bang khong, do mo (blur) bang khong, `inset` hay khong deu duoc, mau la mot token. Do la
 *    net ma trinh duyet ve giong het mot vien (vd `inset 0 0 0 1px var(--color-rule)` o giay.css). Khong
 *    co gang doc box-shadow noi chung: mot lop co do mo hoac do lech thuc su la bong do, khong phai bien,
 *    va khong duoc do.
 *  - Nguong: 4.5 cho cap co `color`, 3.0 cho cap co vien/outline/vong box-shadow (WCAG khong suy duoc co
 *    chu tu CSS nen lay nguong chat hon trong hai nguong van ban cua WCAG).
 */

const BE_MAT = ["--color-paper", "--color-paper-2", "--color-paper-3"] as const;

interface KhoiQuyTac {
  selector: string;
  decls: string;
}

/** Tach CSS thanh cac khoi { bo chon, khai bao }. @media/@keyframes duoc di vao ben trong (bo chon cua
 *  chinh at-rule khong duoc coi la mot khoi can do). */
function duyetKhoi(css: string): KhoiQuyTac[] {
  const sach = boComment(css);
  const out: KhoiQuyTac[] = [];
  function di(text: string): void {
    let i = 0;
    while (i < text.length) {
      const mo = text.indexOf("{", i);
      if (mo === -1) break;
      // Chi phan sau dau ";" cuoi cung la prelude cua khoi nay: truoc no co the la cau lenh ket thuc bang ";"
      // (vd cac dong @import dung ngay truoc `html, body{...}` trong globals.css), khong thuoc khoi.
      const truoc = text.slice(i, mo);
      const boChon = truoc.slice(truoc.lastIndexOf(";") + 1).trim();
      let sau = 1;
      let j = mo + 1;
      while (j < text.length && sau > 0) {
        if (text[j] === "{") sau++;
        else if (text[j] === "}") sau--;
        j++;
      }
      const than = text.slice(mo + 1, j - 1);
      if (boChon.startsWith("@")) di(than);
      else if (boChon.length > 0) {
        // CSS long (`&`, bo chon con ben trong mot quy tac) bo doc nay khong di vao: khai bao cua khoi con se bi
        // doc thanh rac va khong duoc do. Do ngay bay gio thay vi lang le mu.
        expect(than, `${boChon}: khoi quy tac long ben trong, cong tuong phan chua doc duoc CSS long`).not.toContain("{");
        out.push({ selector: boChon, decls: than });
      }
      i = j;
    }
  }
  di(sach);
  return out;
}

function tachKhaiBao(decls: string): { prop: string; value: string }[] {
  return decls
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const hai = s.indexOf(":");
      return hai === -1 ? { prop: "", value: "" } : { prop: s.slice(0, hai).trim(), value: s.slice(hai + 1).trim() };
    })
    .filter((d) => d.prop.length > 0);
}

/** Cac thuoc tinh khoanh vien: vien day du, tung canh rieng, va outline (vong focus). Dung chung nguong
 *  3.0 voi border-color vi ve mat thi giac day deu la net vien, khong phai khoi chu. */
const VIEN_VA_OUTLINE = new Set([
  "border-color",
  "border",
  "border-top",
  "border-bottom",
  "border-left",
  "border-right",
  "border-top-color",
  "border-bottom-color",
  "border-left-color",
  "border-right-color",
  "outline",
  "outline-color",
]);

const TOKEN_DON = /^var\(\s*(--[\w-]+)\s*\)$/;
const TOKEN_BAT_KY = /var\(\s*(--[\w-]+)\s*\)/;
const MIX_TRONG_SUOT_DON = /^color-mix\(\s*in\s+oklch\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*([\d.]+)%\s*,\s*transparent\s*\)$/;
const MIX_TRONG_SUOT_BAT_KY = /color-mix\(\s*in\s+oklch\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*([\d.]+)%\s*,\s*transparent\s*\)/;

/** Mot mau chu/vien suy tu CSS: hoac dung mot token (mau phang), hoac token do pha voi trong suot P%
 *  (`color-mix(in oklch, var(--x) P%, transparent)`) - hien thi thuc te la P% --x tron voi thu dang sau. */
type MoTaMauNguon = { kind: "token"; token: string } | { kind: "mix"; token: string; alpha: number };

/** Doc gia tri phai la DUNG mot bieu thuc mau, nguyen ven (dung cho `color`: khong phai "inherit" hay
 *  currentColor, khong co phan thua nhu do rong net). */
function moTaDonLe(value: string): MoTaMauNguon | null {
  const v = value.trim();
  const donGian = TOKEN_DON.exec(v);
  if (donGian) return { kind: "token", token: donGian[1] };
  const mix = MIX_TRONG_SUOT_DON.exec(v);
  if (mix) return { kind: "mix", token: mix[1], alpha: Number(mix[2]) / 100 };
  return null;
}

/** Doc mau o bat ky dau trong gia tri (dung cho vien/outline rut gon, vd "1px solid var(--x)"). */
function moTaBatKy(value: string): MoTaMauNguon | null {
  const v = value.trim();
  const mix = MIX_TRONG_SUOT_BAT_KY.exec(v);
  if (mix) return { kind: "mix", token: mix[1], alpha: Number(mix[2]) / 100 };
  const donGian = TOKEN_BAT_KY.exec(v);
  if (donGian) return { kind: "token", token: donGian[1] };
  return null;
}

/** Mau hien thi that su cua mot MoTaMauNguon tren mot nen cu the: mau don thi giu nguyen, mau pha voi
 *  trong suot thi tron alpha% cua no voi chinh nen dang xet (P% mau + (1-P)% nen, tung kenh sRGB). */
function mauHienThi(nguon: MoTaMauNguon, mauGoc: Srgb, nen: Srgb): Srgb {
  if (nguon.kind === "token") return mauGoc;
  const a = nguon.alpha;
  return [a * mauGoc[0] + (1 - a) * nen[0], a * mauGoc[1] + (1 - a) * nen[1], a * mauGoc[2] + (1 - a) * nen[2]];
}

/** Tach gia tri `box-shadow` thanh tung lop, o dau phay o DO SAU NGOAC BANG 0 (vd `color-mix(in oklch,
 *  var(--x) 70%, transparent)` co dau phay ben trong khong duoc tinh la mot lop moi). */
function tachLopBoxShadow(value: string): string[] {
  const out: string[] = [];
  let sau = 0;
  let dau = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "(") sau++;
    else if (c === ")") sau--;
    else if (c === "," && sau === 0) {
      out.push(value.slice(dau, i));
      dau = i + 1;
    }
  }
  out.push(value.slice(dau));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

function laDoDaiBangKhong(v: string): boolean {
  return /^0(?:px|em|rem|%)?$/.test(v);
}

/** Mot lop `box-shadow` co phai VONG VIEN khong: `[inset] offsetX offsetY blur [spread] mau`, offsetX,
 *  offsetY va blur deu bang khong (spread la do day vong, khac khong hay khong cung duoc). Mau phai la
 *  mot token don hoac mix-voi-trong-suot (dung lai ham doc mau da co). Tra null neu khong phai dang nay
 *  (vd co do mo/do lech thuc su: do la bong do, khong phai vien, khong doi tuong phan). */
function moTaVongBoxShadow(lop: string): MoTaMauNguon | null {
  let text = lop.trim();
  text = text.replace(/^inset\s+/i, "").replace(/\s+inset$/i, "").trim();
  const mVar = /var\(\s*--[\w-]+\s*\)\s*$/.exec(text);
  const viTriMix = text.indexOf("color-mix(");
  let mauText: string;
  let truocMau: string;
  if (mVar) {
    mauText = text.slice(mVar.index).trim();
    truocMau = text.slice(0, mVar.index).trim();
  } else if (viTriMix !== -1 && text.trimEnd().endsWith(")")) {
    mauText = text.slice(viTriMix).trim();
    truocMau = text.slice(0, viTriMix).trim();
  } else {
    return null; // khong doc duoc mau o cuoi lop: khong phai dang cong nay nhan biet duoc
  }
  const soDo = truocMau.split(/\s+/).filter((s) => s.length > 0);
  if (soDo.length !== 4) return null; // luon can offsetX offsetY blur spread de la mot vong ro rang
  if (!laDoDaiBangKhong(soDo[0]) || !laDoDaiBangKhong(soDo[1]) || !laDoDaiBangKhong(soDo[2])) return null;
  return moTaBatKy(mauText);
}

type Nen = { biet: true; token: string } | { biet: false };

/** Nen hieu dung cua chinh khoi. transparent, color-mix(...) hoac bat ky gia tri nao khac khong phai dung
 *  mot token (vd linear-gradient nhieu mau) deu la "chua biet": khong lang le bo qua, ma tra ve chua biet
 *  de noi goi roi do voi ca ba be mat. Khong khai background nao trong
 *  khoi cung la chua biet, giong het truong hop khoi chi khai mau chu ma khong khai nen. */
function nenCuaKhoi(value: string | null): Nen {
  if (value === null) return { biet: false };
  const v = value.trim();
  if (v === "transparent") return { biet: false };
  if (v.includes("color-mix(")) return { biet: false };
  const m = TOKEN_DON.exec(v);
  return m ? { biet: true, token: m[1] } : { biet: false };
}

type LoaiDo = "color" | "vien";

function loaiCuaThuocTinh(prop: string): LoaiDo {
  return prop === "color" ? "color" : "vien";
}

function nguongCuaThuocTinh(prop: string): number {
  return prop === "color" ? 4.5 : 3.0;
}

interface MienTru {
  /** Ten ngan, dung de doi chieu la mien tru con duoc dung hay da mo coi (xem kiem tra cuoi bai). */
  ten: string;
  loai: LoaiDo;
  fgToken: string;
  /** Bo chon duoc mien (mot hoac nhieu). Khong ghi selector = mien cho moi bo chon dung token nay
   *  (chi dung khi that su khong con truong hop nao khac co the xuat hien, xem ly do tung dong). */
  selector?: string | string[];
  lyDo: string;
}

function khopSelector(mt: MienTru, selector: string): boolean {
  if (mt.selector === undefined) return true;
  if (Array.isArray(mt.selector)) return mt.selector.includes(selector);
  return mt.selector === selector;
}

/*
 * Danh sach mien tru (chi cho phep khi "khong the tranh duoc", phai co ten va mot cau ly do ngay tai
 * day). Day KHONG phai noi long nguong: nguong van la 4.5 / 3.0 cho moi cap khac. Moi mien tru duoi day
 * duoc ghi RIENG cho tung bo chon (khong mien theo token cho "moi bo chon dung token nay"): mot mien tru
 * khong selector se mien ca nhung bo chon tuong lai dung cung token ma khong ai kiem lai co that su la
 * trang tri hay khong (day chinh la loi da xay ra voi .swatch, mot dieu khien radio that, truoc day). Moi ly do
 * duoi day da duoc doi chieu voi component TSX thuc te dung selector do.
 */
const MIEN_TRU: MienTru[] = [
  {
    ten: "ke-trang-tri-khoi-tinh",
    loai: "vien",
    fgToken: "--color-rule",
    selector: [
      // Card/panel noi dung tinh: vien chi de tach vung, khong phai bien cua dieu khien.
      ".hoat-dong",
      ".book",
      ".nhap-ds",
      ".luot-ds",
      ".nhan-cu",
      ".nhac-the",
      ".hoi-dap", // khung Loi hoi dap (RoundReplyPanel.tsx): the noi dung tinh; o chu va nut ben trong co vien rieng dat nguong
      ".thu-thach",
      ".goi-y",
      ".tai-anh",
      ".ghi-am-hop",
      // Gach chia/duong ke duoi thanh dieu huong: cung mot vai tro, khac hinh dang.
      ".nav",
      ".viet-tren",
      ".foot",
      ".nhap + .nhap",
      ".luot + .luot",
      // Hai muc dong thoi gian cua man Sua sach (CoverTimeline.tsx, TrackTimeline.tsx): cung vai tro va cung hinh
      // dang voi .luot-ds ngay tren no, khung noi dung tinh cong vach chia giua cac dong. Moi dieu khien ben trong
      // (nut, o chon bia, o nhap nhac) co vien va trang thai rieng dat nguong.
      ".moc-ds",
      ".moc + .moc",
      ".go-cua__dong + .go-cua__dong",
      // Vach chia giua cac cot cua khung dang trang (PublishBar.tsx PublishPanel): tach cot chon loai, cot cac o va
      // cot to giay, va tach cau xac nhan khoi danh sach loai. Moi dieu khien ben trong (radio, o nhap, nut) co
      // vien/trang thai rieng dat nguong.
      ".niem__chon",
      ".niem__form",
      ".niem__cuoi",
      ".niem__chon, .niem__form",
      // Hop Tha tam trang (ThaTamTrang.tsx): khung bao va vach chia truoc dong "Xem lich hoa". Moi dieu khien ben
      // trong (o troi da chon, o nhap, nut) co vien va trang thai rieng dat nguong.
      ".tha",
      ".tha__lich",
      // Lich hoa (LichHoa.tsx): vach chia giua cac tuan va khung chi tiet ngay. O ngay la nut that, vien trang thai
      // dang chon cua no dung --blue-line tren --blue-1 va dat nguong.
      ".tuan",
      ".chi-tiet",
      // Hop xac nhan xoa sach / bo nhap tren the /ban-nhap (DraftRemove.tsx): duong ke tach hang cau hoi khoi
      // phan tren cua chinh the, khong phai vien cua dieu khien nao.
      ".nhap__hoi",
      // Hop xac nhan gui loi hoi dap trong khung Loi hoi dap (RoundReplyPanel.tsx): cung vai tro voi .nhap__hoi,
      // duong ke tach hang cau hoi khoi o chu ben tren trong cung mot the, khong phai vien cua dieu khien nao.
      ".hoi-dap .dang-hoi",
      // Cung mot vai tro nhung vien la mot vong box-shadow 0/0/0 (vd inset 0 0 0 1px), khong phai border.
      ".to-giay", // to giay: khung trang giay trong sach/man viet (PagedSurface.tsx, SealPanel.tsx, Flipbook.tsx)
      ".khoi-ghi-am", // khoi ghi am nhung trong bai (figure, mediaNodes.tsx): khung chua, khong phai nut ben trong
      ".sach__lop", // lop trang trong hieu ung lat sach (Flipbook.tsx): khung dung, khong tuong tac
      ".bia-mo__hinh", // khung anh bia da mo (BookCover.tsx): khung trang tri quanh anh, khong tuong tac
    ],
    lyDo:
      "--color-rule (92% L, gan do sang cua giay) dung lam vien/gach chia trang tri cho cac khoi va danh " +
      "sach NOI DUNG TINH (card, panel, to giay, khung anh, gach ngan giua cac muc lien tiep): khong co " +
      "input/button/role tuong tac nao ma trang thai cua no phu thuoc vao chinh net nay de nhan biet (khac " +
      "voi dieu khien that nhu .swatch hay nut co trang thai bam, ca hai da doi sang " +
      "--color-rule-ui/--blue-line). WCAG 1.4.11 doi hoi tuong phan cho ranh gioi/trang thai cua THANH " +
      "PHAN GIAO DIEN, khong doi hoi cho gach chia hay khung bao trang tri cua noi dung tinh, du net do " +
      "duoc ve bang border hay bang mot vong box-shadow 0/0/0.",
  },
  {
    ten: "khoi-am-thanh-tat-an-khoi-a11y",
    loai: "vien",
    fgToken: "--color-rule",
    selector: ".khoi-ghi-am__nut--tat .khoi-ghi-am__tron",
    lyDo:
      "Phan tu goc la <span aria-hidden=\"true\"> (AudioBlock.tsx:70, trang thai 'khong co ghi am'), khong " +
      "phai <button> that (so voi .khoi-ghi-am__nut binh thuong o dong 110 cung tep): an hoan toan khoi cay " +
      "truy cap va khong the tuong tac, nen khong phai mot thanh phan giao dien theo nghia WCAG 1.4.11 du " +
      "tuong phan the nao.",
  },
  {
    ten: "cham-doc-quyen-an-khoi-a11y",
    loai: "vien",
    fgToken: "--color-paper",
    selector: ".book__owner",
    lyDo:
      "Chinh la <span className=\"av book__owner\" aria-hidden=\"true\"> (BookCard.tsx:37, huy hieu nho " +
      "danh dau chu so huu cuon sach de len goc bia): an hoan toan khoi cay truy cap, nen khong phai mot " +
      "thanh phan giao dien theo nghia WCAG 1.4.11 du tuong phan the nao. Vong box-shadow cua no dung " +
      "color-mix(in oklch, var(--color-paper) 70%, transparent) nen fgToken ghi la --color-paper.",
  },
  {
    ten: "vong-sang-da-chon-la-phu-swatch",
    loai: "vien",
    fgToken: "--blue-1",
    selector: ".swatch:has(input:checked)",
    lyDo:
      "Trang thai 'da chon' cua .swatch da duoc bao boi border-color: var(--blue-line) trong CUNG mot " +
      "khoi (rieng no da qua nguong 3.0 tren ca ba be mat, xem mien tru khac khong can cho no). Vong " +
      "box-shadow 3px --blue-1 chi la hieu ung phu (hao quang mem quanh o), khong phai dau hieu DUY NHAT " +
      "cua trang thai, nen WCAG 1.4.11 da duoc dieu vien no dap ung du vong sang nay khong tu no dat 3:1.",
  },
  {
    ten: "quang-giay-o-cua-so",
    loai: "vien",
    fgToken: "--color-paper",
    selector: ".cua-so__kinh",
    lyDo:
      "Lop box-shadow thu hai cua o cua so tren dai troi (BauTroi.tsx) la quang giay 4px (color-mix(in oklch, var(--color-paper) " +
      "55%, transparent)) de o tron noi len khoi bau troi lon: trang tri, khong phai ranh gioi. Ranh gioi cua o la vien 1px " +
      "mau muc cua troi trong o (currentColor, muc do da qua 4.5 tren troi, tam-trang-mau.test.ts), va trang thai focus la vong " +
      "2.5px --color-focus bam hinh tron (.cua-so:focus-visible .cua-so__kinh). Phan tu .cua-so__kinh an voi trinh doc man hinh.",
  },
  {
    ten: "o-trong-lich-hoa",
    loai: "vien",
    fgToken: "--blue-3",
    selector: ".hoa-trong",
    lyDo:
      "Vong cham tron cua lan chua tha tam trang tren Lich hoa (LichHoa.tsx): <span> nam trong nut ngay hoac trong khung chi " +
      "tiet, an voi trinh doc man hinh (aria-hidden, nhan cua nut ngay da noi 'chua tha'), khong tuong tac va khong mang " +
      "trang thai. Ban mau da duyet co y ve no rat nhat de ngay trong khong tranh mat voi bong hoa; WCAG 1.4.11 khong doi " +
      "tuong phan cho hinh trang tri khong phai thanh phan giao dien.",
  },
];

function timMienTru(loai: LoaiDo, fgToken: string, selector: string): MienTru | undefined {
  return MIEN_TRU.find((m) => m.loai === loai && m.fgToken === fgToken && khopSelector(m, selector));
}

describe("cong tuong phan: suy cap mau tu chinh CSS, khong danh sach viet tay", () => {
  const bangMau = docBangToken();

  it("doc duoc bang token mau tu tokens.css (tu kiem bo do khong bi rong)", () => {
    expect(Object.keys(bangMau).length).toBeGreaterThan(10);
    expect(bangMau["--color-paper"]).toBeDefined();
    expect(bangMau["--color-ink"]).toBeDefined();
  });

  it("moi cap mau/vien/outline suy tu CSS deu dat nguong tuong phan WCAG", () => {
    const tepCss = readdirSync(THU_MUC_CSS)
      .filter((f) => f.endsWith(".css") && f !== "tokens.css")
      .map((f) => `${THU_MUC_CSS}/${f}`);
    expect(tepCss.length).toBeGreaterThan(0);

    const loi: string[] = [];
    let soCapDaDo = 0;
    const mienTruDaDung = new Set<string>();
    /** Moi bo chon TUNG gap trong luc duyet CSS (bat ke thuoc tinh gi, bat ke dat hay truot), dung de
     *  phat hien mien tru mo coi (xem kiem tra cuoi bai). */
    const boChonDaGap = new Set<string>();

    function doCap(file: string, selector: string, thuocTinh: string, nguon: MoTaMauNguon, nen: Nen): void {
      // Token mau/nen khong co trong tokens.css (go sai ten, hay mot bien khong phai mau) la mot cap KHONG do
      // duoc: bao loi thay vi bo qua, vi trinh duyet cung bo khai bao do va khong cong nao khac thay.
      const mauGoc = bangMau[nguon.token];
      if (mauGoc === undefined) {
        loi.push(`${file} "${selector}": ${thuocTinh} dung ${nguon.token}, token khong phai mau trong tokens.css`);
        return;
      }
      if (nen.biet && bangMau[nen.token] === undefined) {
        loi.push(`${file} "${selector}": nen dung ${nen.token}, token khong phai mau trong tokens.css`);
        return;
      }
      const nguong = nguongCuaThuocTinh(thuocTinh);
      const ungCu: [string, Srgb][] = nen.biet
        ? [[nen.token, bangMau[nen.token]]]
        : BE_MAT.map((bm) => [bm, bangMau[bm]]);
      for (const [tenNen, bg] of ungCu) {
        soCapDaDo++;
        const fg = mauHienThi(nguon, mauGoc, bg);
        const ty = contrastRatio(fg, bg);
        if (ty < nguong) {
          const mt = timMienTru(loaiCuaThuocTinh(thuocTinh), nguon.token, selector);
          if (mt !== undefined) {
            mienTruDaDung.add(mt.ten);
            continue;
          }
          const nhan = nguon.kind === "token" ? nguon.token : `color-mix(${nguon.token} ${Math.round(nguon.alpha * 100)}%)`;
          const ghiChuNen = nen.biet ? "" : " (nen chua biet tu CSS, do voi be mat)";
          loi.push(
            `${file} "${selector}": ${thuocTinh} ${nhan} tren ${tenNen}${ghiChuNen} = ${ty.toFixed(2)}, can >= ${nguong}`,
          );
        }
      }
    }

    for (const file of tepCss) {
      const css = readFileSync(file, "utf8");
      for (const khoi of duyetKhoi(css)) {
        let colorValue: string | null = null;
        let bgValue: string | null = null;
        let boxShadowValue: string | null = null;
        const vienGtCuoi: Record<string, string> = {};
        for (const { prop, value } of tachKhaiBao(khoi.decls)) {
          if (prop === "color") colorValue = value;
          else if (prop === "background" || prop === "background-color") bgValue = value;
          else if (prop === "box-shadow") boxShadowValue = value;
          else if (VIEN_VA_OUTLINE.has(prop)) vienGtCuoi[prop] = value;
        }
        const nen = nenCuaKhoi(bgValue);
        boChonDaGap.add(khoi.selector);

        if (colorValue !== null) {
          const moTa = moTaDonLe(colorValue);
          if (moTa !== null) doCap(file, khoi.selector, "color", moTa, nen);
        }

        for (const [prop, value] of Object.entries(vienGtCuoi)) {
          const moTa = moTaBatKy(value);
          if (moTa !== null) doCap(file, khoi.selector, prop, moTa, nen);
        }

        if (boxShadowValue !== null) {
          for (const lop of tachLopBoxShadow(boxShadowValue)) {
            const moTa = moTaVongBoxShadow(lop);
            if (moTa !== null) doCap(file, khoi.selector, "box-shadow", moTa, nen);
          }
        }
      }
    }

    // Neu con so nay tut ve gan 0 thi bo phan tich CSS da hong (vd khong tim thay khoi quy tac nao nua),
    // va bai kiem se "dat" gia vi khong con gi de do. Chan truoc kha nang do.
    expect(soCapDaDo).toBeGreaterThan(50);
    expect(loi).toEqual([]);

    // Mien tru khong duoc mo coi, kiem TUNG BO CHON chu khong kiem theo ten: mot mien tru 18 bo chon van
    // "duoc dung" (ten co trong mienTruDaDung) mien la MOT trong so do con truot, nen kiem theo ten khong
    // bat duoc bo chon da bien mat (vd doi ten class) neu con bo chon khac trong cung mien tru van truot.
    // "Mo coi" o day nghia la BO CHON KHONG CON XUAT HIEN trong CSS nua (doi ten, xoa): mot bo chon van
    // con trong CSS nhung cap cua no gio da dat (token duoc sua dung) KHONG phai mo coi, vi khong ai
    // phai di tim xem no con dung khong, no van ro rang truoc mat trong CSS; chi khi bo chon bien mat
    // hoan toan thi khong con gi de doi chieu nua, va do la luc mien tru "roi" ma khong ai biet.
    const boChonMoCoi: string[] = [];
    for (const mt of MIEN_TRU) {
      if (mt.selector === undefined) {
        if (!mienTruDaDung.has(mt.ten)) boChonMoCoi.push(`${mt.ten}: mien tru khong con cham toi cap nao (blanket)`);
        continue;
      }
      const dsSelector = Array.isArray(mt.selector) ? mt.selector : [mt.selector];
      for (const s of dsSelector) {
        if (!boChonDaGap.has(s)) boChonMoCoi.push(`${mt.ten}: bo chon "${s}" khong con xuat hien trong CSS`);
      }
    }
    expect(boChonMoCoi).toEqual([]);
  });
});

import type { DocJson } from "./types";

/** Nut tai lieu nhin chung: khoi, muc danh sach, doan, chu hay xuong dong. */
type Nut = { type: string; content?: Nut[]; noiTiep?: true; text?: string; marks?: unknown[]; attrs?: unknown };

const laNoiDong = (n: Nut) => n.type === "text" || n.type === "hardBreak";

/** Cac nut tren nhanh con dau tien (hay cuoi cung) cua goc, tu tang 1 xuong toi khoi chu, khong xuong toi chu. */
function nhanh(goc: Nut, cuoi: boolean): Nut[] {
  const out: Nut[] = [];
  let n = goc;
  for (;;) {
    const con = n.content ?? [];
    const k = cuoi ? con[con.length - 1] : con[0];
    if (!k || laNoiDong(k)) return out;
    out.push(k);
    n = k;
  }
}

/**
 * So tang can noi giua to truoc va to sau: bao nhieu nut tren nhanh dau cua to sau la phan tiep cua nut tren nhanh
 * cuoi cua to truoc. splitDoc dat dau noiTiep tren moi nut bi cat, va nut bi cat thi moi nut bao no cung bi cat.
 * To cat theo cach cu chi co dau tren muc danh sach: muc chi gom mot doan, nen doan cua muc cung bi cat. To cu khong
 * co dau nao ma to truoc ket thuc bang mot lan xuong dong (Shift+Enter) thi cho ngat nam ngay sau lan xuong dong do,
 * trong cung mot doan. Hai nhanh phai cung loai o moi tang duoc noi; lech thi dung o tang lech.
 */
function soTangNoi(truoc: Nut, sau: Nut, catMoi: boolean): number {
  const dau = nhanh(sau, false);
  const cuoi = nhanh(truoc, true);
  let d = 0;
  dau.forEach((n, i) => {
    if (n.noiTiep === true) d = i + 1;
  });
  if (d > 0 && dau[d - 1].type === "listItem") d += 1;
  const doanCuoi = cuoi[cuoi.length - 1];
  const hetBangXuongDong = doanCuoi?.type === "paragraph" && doanCuoi.content?.[doanCuoi.content.length - 1]?.type === "hardBreak";
  if (!catMoi && d === 0 && hetBangXuongDong) d = dau.length;
  let k = 0;
  while (k < d && k < cuoi.length && k < dau.length && cuoi[k].type === dau[k].type) k++;
  return k;
}

/** Gop hai nut chu lien nhau cung dinh dang, nhu ProseMirror tu gop khi dung tai lieu. Doan rong thi khong co content. */
function gopChu(n: Nut): void {
  const out: Nut[] = [];
  for (const k of n.content ?? []) {
    const t = out[out.length - 1];
    if (t && t.type === "text" && k.type === "text" && JSON.stringify(t.marks ?? []) === JSON.stringify(k.marks ?? [])) {
      out[out.length - 1] = { ...t, text: `${t.text ?? ""}${k.text ?? ""}` };
    } else {
      out.push(k);
    }
  }
  if (out.length > 0) n.content = out;
  else delete n.content;
}

/** Noi b vao sau a, gop d tang tren nhanh cuoi cua a voi nhanh dau cua b. */
function noi(a: Nut, b: Nut, d: number): void {
  const conA = a.content ?? [];
  const conB = b.content ?? [];
  if (d === 0) {
    a.content = [...conA, ...conB];
    gopChu(a);
    return;
  }
  noi(conA[conA.length - 1], conB[0], d - 1);
  a.content = [...conA, ...conB.slice(1)];
}

function boDau(n: Nut): void {
  delete n.noiTiep;
  for (const k of n.content ?? []) boDau(k);
}

/**
 * Noi cac to cua mot luot thanh mot tai lieu cho trinh viet. To cat bang splitDoc co dau noiTiep: noi roi cat lai o
 * cung cac cho ngat ra dung cac to cu, nen xep trang lai ngat dung cho cu khi chua sua gi. To cu thieu dau tren doan
 * va trich dan: phan sau cua khoi bi cat thanh khoi rieng, cho ngat va noi dung tung to van y nhu cu. Tai lieu tra ve
 * khong con dau noiTiep nao (so do cua trinh viet khong co dau do). Thuan, khong doi dau vao.
 */
export function joinSheets(sheets: readonly DocJson[]): DocJson {
  const [dau, ...con] = sheets.map((s) => structuredClone(s) as unknown as Nut);
  if (!dau) return { type: "doc", content: [{ type: "paragraph" }] };
  // Cach cat moi dat dau tren doan, danh sach, trich dan bi cat ngang: co mot dau nhu vay la ca luot cat theo cach moi.
  const catMoi = con.some((to) => nhanh(to, false).some((n) => n.noiTiep === true && n.type !== "listItem"));
  for (const to of con) noi(dau, to, soTangNoi(dau, to, catMoi));
  boDau(dau);
  return dau as unknown as DocJson;
}

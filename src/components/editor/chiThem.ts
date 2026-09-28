import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { soSanh, tachTu, vanBanKhoi, type Tu } from "@/lib/doc/chi-them";
import type { DocJson } from "@/lib/doc/types";
import { isMediaNodeType, mediaIdsOf } from "@/lib/media/node";

/*
 * Luat sua luot (chu du an 28/09) ngay trong trinh sua: chi viet them va sua chinh ta. Plugin nay khong chan go phim
 * (sua chinh ta can xoa vai ky tu roi go lai), ma to mau ket qua: chu vua them hay vua sua co nen xanh nhat, chu cu bi
 * mat hien lai dung cho, mo va gach ngang, bam la tra lai. May chu van la noi quyet (editRound tu choi "deleted").
 * Rieng khoi media cu thi chan han: khong co trang thai trung gian nao can bo mot anh da dang.
 */

/** Ket qua cua lan tinh gan nhat, de man sua bao mot dong va khoa nut Luu. */
export type TrangThaiChiThem = { mat: number; them: number; sua: number };

export type ChiThemOptions = {
  /** Ban da dang cua luot (cac to da noi). null thi khong tinh gi. */
  goc: DocJson | null;
  onDoi: (tt: TrangThaiChiThem) => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    chiThem: {
      /** Tra lai moi chu cu dang bi mat, dung cho cua tung chu. */
      traLaiHet: () => ReturnType;
    };
  }
}

/** Doi nguoi viet ngung go mot nhip roi moi tinh lai: bo go tieng Viet xoa roi go lai tung ky tu. */
const NGHI_MS = 300;
/** Meta cua giao dich tra lai chu: tinh lai ngay, khong doi nhip. */
const TINH_NGAY = "tinh-ngay";

/** Trang thai cua plugin: cac trang tri dang ve, va co tinh lai ngay sau giao dich vua roi. */
type TrangThai = { deco: DecorationSet; ngay: boolean };

export const chiThemKey = new PluginKey<TrangThai>("chiThem");

/** Mot cho chen lai chu cu: "sau" la ngay sau mot chu moi, "truoc" la ngay truoc mot chu moi. */
type ChoChen = { pos: number; kieu: "sau" | "truoc"; chu: string };

/** Moi doan cua tai lieu dang sua: chu cua doan (xuong dong la "\n") va vi tri ky tu dau tien cua doan. */
function khoiCua(doc: PMNode): { chu: string; bat: number }[] {
  const out: { chu: string; bat: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return true;
    out.push({ chu: node.textBetween(0, node.content.size, "\n", "\n"), bat: pos + 1 });
    return false;
  });
  return out;
}

/** Id cac khoi media cap cao nhat cua tai lieu dang sua. */
function mediaCua(doc: PMNode): Set<string> {
  const ids = new Set<string>();
  doc.forEach((node) => {
    const id: unknown = node.attrs.id;
    if (isMediaNodeType(node.type.name) && typeof id === "string") ids.add(id);
  });
  return ids;
}

const LA_CHU = /[\p{L}\p{N}]/u;
const LA_TRANG = /\s/u;

/** Chen lai mot cum chu cu vao dung cho, giu mot khoang trang giua cac chu. */
function chenLai(tr: Transaction, cho: ChoChen): void {
  const doc = tr.doc;
  const ky = (p: number) => (p >= 0 && p < doc.content.size ? doc.textBetween(p, p + 1, "\n", "\n") : "");
  if (cho.kieu === "truoc") {
    tr.insertText(`${cho.chu} `, cho.pos);
    return;
  }
  if (LA_TRANG.test(ky(cho.pos))) {
    // "Chiều ." (vua xoa "nay"): chen sau khoang trang, them khoang trang nua chi khi lien sau la mot chu.
    tr.insertText(LA_CHU.test(ky(cho.pos + 1)) ? `${cho.chu} ` : cho.chu, cho.pos + 1);
  } else {
    tr.insertText(` ${cho.chu}`, cho.pos);
  }
}

/** Chu cu bi mat, hien lai dung cho: bam, Enter hay Space thi chen tra lai. */
function nutTraLai(view: EditorView, cho: ChoChen): HTMLElement {
  const nut = document.createElement("span");
  nut.className = "chu-mat";
  nut.textContent = cho.chu;
  nut.contentEditable = "false";
  nut.tabIndex = 0;
  nut.setAttribute("role", "button");
  nut.setAttribute("aria-label", `Chữ cũ bị xoá: ${cho.chu}. Bấm để trả lại`);
  const traLai = (e: Event) => {
    e.preventDefault();
    if (!view.editable) return;
    const tr = view.state.tr;
    chenLai(tr, cho);
    view.dispatch(tr.setMeta(chiThemKey, TINH_NGAY));
    view.focus();
  };
  nut.addEventListener("mousedown", (e) => e.preventDefault());
  nut.addEventListener("click", traLai);
  nut.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") traLai(e);
  });
  return nut;
}

type KetQua = { deco: DecorationSet; tt: TrangThaiChiThem; cho: ChoChen[] };

/** So tai lieu dang sua voi ban da dang: trang tri, so chu mat, them, sua, va cac cho chen lai chu cu. */
function tinh(doc: PMNode, cu: readonly Tu[]): KetQua {
  const khoi = khoiCua(doc);
  const moi = tachTu(khoi.map((k) => k.chu));
  const { cap, mat, them } = soSanh(cu, moi);
  const decos: Decoration[] = [];
  const viTri = (t: Tu) => ({ from: khoi[t.khoi].bat + t.dau, to: khoi[t.khoi].bat + t.cuoi });

  // Chu them lien nhau trong cung mot doan gop thanh mot dai nen, ke ca khoang trang giua chung.
  const laThem = new Set(them);
  let dai: { from: number; to: number; khoi: number } | null = null;
  const dongDai = () => {
    if (dai) decos.push(Decoration.inline(dai.from, dai.to, { class: "chu-moi" }));
    dai = null;
  };
  moi.forEach((t, j) => {
    if (!laThem.has(j)) {
      dongDai();
      return;
    }
    const v = viTri(t);
    if (dai && dai.khoi === t.khoi) dai.to = v.to;
    else {
      dongDai();
      dai = { ...v, khoi: t.khoi };
    }
  });
  dongDai();
  let sua = 0;
  for (const [, j, g] of cap) {
    if (g !== 1) continue;
    sua++;
    const v = viTri(moi[j]);
    decos.push(Decoration.inline(v.from, v.to, { class: "chu-moi" }));
  }

  // Chu cu bi mat: dat sau chu moi ghep voi chu cu dung truoc no neu hai chu cu cung doan, khong thi truoc chu moi ghep
  // voi chu cu dung sau no. Cac chu mat lien nhau cung mot cho gop thanh mot cum.
  // cap cua soSanh da theo thu tu tang dan cua ca chu cu lan chu moi.
  const theoCu = cap;
  const cho: ChoChen[] = [];
  let k = 0;
  for (const i of mat) {
    while (k < theoCu.length && theoCu[k][0] < i) k++;
    const truoc = k > 0 ? theoCu[k - 1] : null;
    const sau = k < theoCu.length ? theoCu[k] : null;
    let moiCho: Omit<ChoChen, "chu">;
    if (truoc && cu[truoc[0]].khoi === cu[i].khoi) moiCho = { pos: viTri(moi[truoc[1]]).to, kieu: "sau" };
    else if (sau) moiCho = { pos: viTri(moi[sau[1]]).from, kieu: "truoc" };
    else if (truoc) moiCho = { pos: viTri(moi[truoc[1]]).to, kieu: "sau" };
    else moiCho = { pos: khoi[0]?.bat ?? 1, kieu: "truoc" };
    const cuoi = cho.at(-1);
    if (cuoi && cuoi.pos === moiCho.pos && cuoi.kieu === moiCho.kieu) cuoi.chu = `${cuoi.chu} ${cu[i].chu}`;
    else cho.push({ ...moiCho, chu: cu[i].chu });
  }
  for (const c of cho) {
    decos.push(Decoration.widget(c.pos, (view) => nutTraLai(view, c), {
      side: c.kieu === "sau" ? 1 : -1, key: `mat-${c.kieu}-${c.pos}-${c.chu}`, ignoreSelection: true,
    }));
  }
  return { deco: DecorationSet.create(doc, decos), tt: { mat: mat.length, them: them.length, sua }, cho };
}

/**
 * Tien ich chi nap o man sua luot. Tinh lai sau NGHI_MS khong go (khong tinh khi dang soan bang bo go, tinh ngay khi
 * soan xong), va tinh ngay sau moi lan tra lai chu.
 */
export const ChiThem = Extension.create<ChiThemOptions>({
  name: "chiThem",

  addOptions() {
    return { goc: null, onDoi: () => {} };
  },

  addCommands() {
    return {
      traLaiHet: () => ({ state, tr, dispatch }) => {
        const goc = this.options.goc;
        if (!goc) return false;
        const { cho } = tinh(state.doc, tachTu(vanBanKhoi(goc)));
        if (cho.length === 0) return false;
        // Cac cho da theo thu tu vi tri tang dan: chen tu cuoi len dau de vi tri cua cac cho phia truoc khong doi.
        for (let n = cho.length - 1; n >= 0; n--) chenLai(tr, cho[n]);
        if (dispatch) dispatch(tr.setMeta(chiThemKey, TINH_NGAY));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { goc, onDoi } = this.options;
    if (!goc) return [];
    const cu = tachTu(vanBanKhoi(goc));
    const khoa = new Set(mediaIdsOf(goc));
    return [
      new Plugin<TrangThai>({
        key: chiThemKey,
        state: {
          init: (_, state) => ({ deco: tinh(state.doc, cu).deco, ngay: false }),
          apply: (tr, truoc) => {
            const meta: unknown = tr.getMeta(chiThemKey);
            if (meta instanceof DecorationSet) return { deco: meta, ngay: false };
            return { deco: truoc.deco.map(tr.mapping, tr.doc), ngay: meta === TINH_NGAY };
          },
        },
        props: {
          decorations: (state) => chiThemKey.getState(state)?.deco,
        },
        // Khong de mat mot khoi media cu nao: giao dich lam mat no bi bo, ke ca dan de hay setContent.
        filterTransaction: (tr, state) => {
          if (!tr.docChanged || khoa.size === 0) return true;
          const truoc = mediaCua(state.doc);
          const sau = mediaCua(tr.doc);
          for (const id of khoa) if (truoc.has(id) && !sau.has(id)) return false;
          return true;
        },
        view: (view) => {
          let hen: ReturnType<typeof setTimeout> | undefined;
          const tinhLai = () => {
            if (view.isDestroyed) return;
            const kq = tinh(view.state.doc, cu);
            onDoi(kq.tt);
            view.dispatch(view.state.tr.setMeta(chiThemKey, kq.deco).setMeta("addToHistory", false));
          };
          const henLai = (ms: number) => {
            clearTimeout(hen);
            hen = setTimeout(tinhLai, ms);
          };
          // Lan dau: bao ngay trang thai cua ban dang mo (co the la ban tam vua khoi phuc).
          henLai(0);
          const khiGoXong = () => henLai(NGHI_MS);
          view.dom.addEventListener("compositionend", khiGoXong);
          return {
            update: (v, truocState) => {
              if (chiThemKey.getState(v.state)?.ngay) {
                henLai(0);
                return;
              }
              if (v.state.doc.eq(truocState.doc)) return;
              clearTimeout(hen);
              if (!v.composing) henLai(NGHI_MS);
            },
            destroy: () => {
              clearTimeout(hen);
              view.dom.removeEventListener("compositionend", khiGoXong);
            },
          };
        },
      }),
    ];
  },
});

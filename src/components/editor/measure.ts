import { DOMSerializer, type Node as PMNode } from "@tiptap/pm/model";
import { mediaBlockHeight } from "@/lib/media/layout";
import { isMediaNodeType, type MediaNode } from "@/lib/media/node";
import type { Unit } from "@/lib/paginate";
import { blockBoundary } from "./split";

/** Mot muc trong mot doan cua ban sao: nut chu hoac the xuong dong, kem vi tri tinh tu dau noi dung doan. */
type Muc = { text: Text; start: number } | { br: HTMLBRElement; start: number };

/** Liet ke nut chu va the <br> theo thu tu. Vi tri khop ProseMirror: moi ky tu 1, moi xuong dong 1, dinh dang 0. */
function mucCua(el: HTMLElement): { muc: Muc[]; size: number } {
  const muc: Muc[] = [];
  let size = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) {
      const text = n as Text;
      if (text.length > 0) {
        muc.push({ text, start: size });
        size += text.length;
      }
    } else if ((n as Element).tagName === "BR") {
      muc.push({ br: n as HTMLBRElement, start: size });
      size += 1;
    }
  }
  return { muc, size };
}

/** Dinh cua ky tu (hoac the xuong dong) o vi tri offset trong doan. */
function dinhTai(muc: Muc[], offset: number, range: Range): number {
  let lo = 0;
  let hi = muc.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (muc[mid].start <= offset) lo = mid;
    else hi = mid - 1;
  }
  const m = muc[lo];
  if ("br" in m) return m.br.getBoundingClientRect().top;
  const i = offset - m.start;
  range.setStart(m.text, i);
  range.setEnd(m.text, i + 1);
  const rects = range.getClientRects();
  return (rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()).top;
}

/** Vi tri cua ky tu dau moi dong trong doan. Dinh ky tu tang dan theo vi tri, nen tim nhi phan tung dong. */
function dauDong(muc: Muc[], size: number): number[] {
  const range = document.createRange();
  const starts = [0];
  let cur = 0;
  let curTop = dinhTai(muc, 0, range);
  while (cur + 1 < size && dinhTai(muc, size - 1, range) > curTop + 0.5) {
    let lo = cur + 1;
    let hi = size - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dinhTai(muc, mid, range) > curTop + 0.5) hi = mid;
      else lo = mid + 1;
    }
    cur = lo;
    curTop = dinhTai(muc, cur, range);
    starts.push(cur);
  }
  return starts;
}

/**
 * Do tai lieu trong ban sao an (rong dung vung chu, cung class .giay-noi-dung) va tra ve cac don vi xep
 * trang, moi dong mot don vi, toa do tinh tu dinh ban sao. Chieu cao doan chia deu cho so dong, vi moi dong
 * cung line-height. Dong dau cua doan ngat o bien khoi an toan; dong sau ngat ngay truoc ky tu dau dong.
 * Khoi media la mot don vi nguyen cao dung mediaBlockHeight tu attrs, khong doi anh tai.
 */
export function measureUnits(mirror: HTMLElement, doc: PMNode): Unit[] {
  mirror.replaceChildren(DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.content));
  // prosemirror-view them <br class="ProseMirror-trailingBreak"> khi doan ket thuc bang xuong dong (Shift+Enter),
  // nen editor co them mot dong trong. Ban sao phai co dung dong do de do khop; DocView cung lam vay.
  // The <br> them nay duoc tinh 1 vi tri, nen dau dong cuoi roi dung vao cuoi noi dung doan, mot vi tri hop le.
  mirror.querySelectorAll("p").forEach((p) => {
    if (p.lastChild?.nodeName === "BR") p.appendChild(document.createElement("br"));
  });
  const blocks: { pos: number; media: MediaNode | null }[] = [];
  doc.descendants((node, pos) => {
    if (isMediaNodeType(node.type.name)) {
      blocks.push({ pos, media: { type: node.type.name, attrs: node.attrs } as MediaNode });
      return false;
    }
    if (node.isTextblock) {
      blocks.push({ pos, media: null });
      return false;
    }
    return true;
  });
  // Khoi media chi o cap cao nhat va khong chua p, nen thu tu phan tu trong ban sao khop thu tu tai lieu.
  const els = mirror.querySelectorAll<HTMLElement>("p, [data-khoi]");
  if (els.length !== blocks.length) throw new Error("ban sao lech so khoi voi tai lieu");

  const origin = mirror.getBoundingClientRect().top;
  const units: Unit[] = [];
  blocks.forEach(({ pos, media }, b) => {
    const el = els[b];
    const box = el.getBoundingClientRect();
    if (media) {
      // O cap cao nhat, vi tri truoc node la cho ngat an toan: cat o day hai phan deu hop le.
      units.push({ top: box.top - origin, bottom: box.top - origin + mediaBlockHeight(media), pos });
      return;
    }
    const { muc, size } = mucCua(el);
    const starts = size === 0 ? [0] : dauDong(muc, size);
    const h = (box.bottom - box.top) / starts.length;
    starts.forEach((offset, i) => {
      units.push({
        top: box.top - origin + i * h,
        bottom: box.top - origin + (i + 1) * h,
        pos: i === 0 ? blockBoundary(doc, pos) : pos + 1 + offset,
      });
    });
  });
  return units;
}

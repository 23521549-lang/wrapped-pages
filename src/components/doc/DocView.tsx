import { Fragment, type ReactNode } from "react";
import { AudioBlock } from "@/components/media/AudioBlock";
import { ImageBlock } from "@/components/media/ImageBlock";
import { docCharCount } from "@/lib/doc/text";
import type { BlockNode, DocJson, InlineNode, MarkType } from "@/lib/doc/types";
import { mediaSrc } from "@/lib/media/node";
import { sliceWhole } from "@/lib/storable";

/**
 * Dau doanKe khong ve gi o man doc: no la viec rieng cua nguoi viet voi khung sach tren ke, khong phai mot dinh dang
 * cua trang; ve ra se thanh mot vet gach chan khong ai giai thich duoc. Bang nay la Record du loai nen them mot kieu
 * dinh dang ma quen quyet dinh o day thi tsc bao ngay.
 */
const THE: Record<MarkType, "strong" | "em" | "u" | null> = { bold: "strong", italic: "em", underline: "u", doanKe: null };

/**
 * Nghi thuc mo: chi hien shown ky tu dau, dem nhu docCharCount (moi ky tu chu 1, moi hardBreak 1).
 * Phan chua go van nam nguyen trong dong, boc trong span .chua-go, nen to giay co dung hinh hoc cua ban day du o
 * moi nhip va chu khong nhay dong. caret duoc chen ngay sau ky tu cuoi da hien.
 */
export type Typing = { shown: number; caret: ReactNode };

/** Trang thai khi di qua tai lieu theo dung thu tu doc. at: so ky tu da di qua; placed: da chen con tro chua. */
type Go = { shown: number; total: number; at: number; placed: boolean; caret: ReactNode };

function datTro(go: Go): ReactNode {
  go.placed = true;
  return go.caret;
}

/**
 * Khoi bat dau sau con tro: chua toi luot go, an dau cham va vach trai (khong doi hinh hoc). Khoi media khong co ky tu
 * nao de go, nen an ca khoi toi khi chu dung truoc no go xong, roi hien ngay.
 */
function chuaToi(go: Go | null): boolean {
  return go !== null && go.placed && go.shown < go.total;
}

function inline(node: InlineNode, key: number, go: Go | null): ReactNode {
  if (node.type === "hardBreak") {
    if (!go) return <br key={key} />;
    const truoc = go.at;
    go.at += 1;
    // Xuong dong luon duoc ve de giu hinh hoc; con tro dung truoc no khi chua go toi, sau no khi no la ky tu cuoi.
    if (!go.placed && go.shown <= truoc) return <Fragment key={key}>{datTro(go)}<br /></Fragment>;
    if (!go.placed && go.at === go.total) return <Fragment key={key}><br />{datTro(go)}</Fragment>;
    return <br key={key} />;
  }
  let out: ReactNode = node.text;
  if (go) {
    const dai = node.text.length;
    const truoc = go.at;
    go.at += dai;
    const toiDa = Math.max(0, Math.min(dai, go.shown - truoc));
    // Khong xe doi mot cap surrogate (vd emoji): nua ky tu se hien thanh o vuong trong mot nhip go.
    const hien = toiDa < dai ? sliceWhole(node.text, toiDa).length : dai;
    if (hien < dai) {
      out = (
        <>
          {node.text.slice(0, hien)}
          {!go.placed && datTro(go)}
          <span className="chua-go">{node.text.slice(hien)}</span>
        </>
      );
    } else if (!go.placed && go.at === go.total) {
      out = <>{node.text}{datTro(go)}</>;
    }
  }
  const marks = node.marks ?? [];
  // Boc tu trong ra ngoai, nen dinh dang dau tien cua mang nam ngoai cung.
  for (let i = marks.length - 1; i >= 0; i--) {
    const Tag = THE[marks[i].type];
    if (Tag !== null) out = <Tag>{out}</Tag>;
  }
  return <Fragment key={key}>{out}</Fragment>;
}

function block(node: BlockNode, key: number, go: Go | null, author: string): ReactNode {
  switch (node.type) {
    case "paragraph": {
      const content = node.content ?? [];
      // prosemirror-view them <br class="ProseMirror-trailingBreak"> khi doan ket thuc bang hardBreak,
      // nen o day them mot <br/> nua de cao bang editor, khop voi bo xep trang va man viet.
      const cuoiLaHardBreak = content.length > 0 && content[content.length - 1].type === "hardBreak";
      return <p key={key}>{content.map((x, j) => inline(x, j, go))}{cuoiLaHardBreak && <br />}</p>;
    }
    case "bulletList":
      return (
        <ul key={key}>
          {node.content.map((item, i) => {
            const cls = [item.noiTiep ? "noi-tiep" : "", chuaToi(go) ? "chua-go-khoi" : ""].filter(Boolean).join(" ");
            return (
              // oxlint-disable-next-line react/no-array-index-key -- doc la du lieu tinh render mot lan tu DocJson, khong chen/xoa/sap lai muc nen index on dinh.
              <li key={i} className={cls || undefined}>{item.content.map((b, j) => block(b, j, go, author))}</li>
            );
          })}
        </ul>
      );
    case "blockquote": {
      const cls = chuaToi(go) ? "chua-go-khoi" : undefined;
      return <blockquote key={key} className={cls}>{node.content.map((b, j) => block(b, j, go, author))}</blockquote>;
    }
    // Key kem id media: to khac dat khoi khac vao cung vi tri thi khoi gan moi, trang thai phat hay loi khong dinh sang.
    case "anh": {
      const { id, w, h } = node.attrs;
      return <ImageBlock key={`${key}:${id}`} id={id} w={w} h={h} author={author} pending={chuaToi(go)} />;
    }
    case "ghi-am": {
      const { id, ms, peaks } = node.attrs;
      return <AudioBlock key={`${key}:${id}`} src={mediaSrc(id)} ms={ms} peaks={peaks} author={author} pending={chuaToi(go)} />;
    }
    default: {
      // Kieu tra ve suy ra la ReactNode chap nhan undefined, nen thieu mot nhanh o day van bien dich
      // sach va khoi do lang le khong hien gi. Gan node vao "never" bat trinh bien dich
      // phai bao loi ngay khi co ai them mot loai khoi vao BlockNode ma quen sua file nay.
      const _: never = node;
      return null;
    }
  }
}

/**
 * Render mot tai lieu da qua cleanDoc thanh phan tu React: chu la nut chu nen React tu thoat, khong bao
 * gio dung dangerouslySetInnerHTML. Dat trong .giay-noi-dung de co dung hinh hoc cua bo xep trang.
 * typing (tuy chon, chi nghi thuc mo dung) an phan chua go tai cho va chen con tro; khong co thi HTML y nhu cu.
 * Khoi anh va ghi am ve bang ImageBlock, AudioBlock, cung lop va kich thuoc voi ban sao do cua man viet; author la biet
 * danh nguoi dang, cho chu thay the va nhan.
 */
export function DocView({ doc, author, typing }: { doc: DocJson; author: string; typing?: Typing }) {
  const total = typing ? docCharCount(doc) : 0;
  const go: Go | null = typing
    ? { shown: Math.min(total, Math.max(0, Math.floor(typing.shown))), total, at: 0, placed: false, caret: typing.caret }
    : null;
  return <>{doc.content.map((b, i) => block(b, i, go, author))}</>;
}

import type { JSONContent } from "@tiptap/core";
import type { DocJson } from "@/lib/doc/types";
import { mediaIdsOf } from "@/lib/media/node";

type Nut = { type?: string; content?: Nut[]; attrs?: Record<string, unknown>; noiTiep?: unknown; [k: string]: unknown };

function doi(node: Nut, fn: (node: Nut) => Nut): Nut {
  const out = fn(node);
  return out.content ? { ...out, content: out.content.map((con) => doi(con, fn)) } : out;
}

/**
 * To da dang sang tai lieu cua trinh soan thao man sua: dau noiTiep cua muc danh sach (chi co tren to da dang, xem
 * src/lib/doc/types.ts) doi thanh attrs.noiTiep ma MucNoiTiep hieu. Thuan, khong doi dau vao.
 */
export function toEditorDoc(doc: DocJson): JSONContent {
  return doi(structuredClone(doc) as Nut, (node) => {
    if (node.type !== "listItem") return node;
    const { noiTiep, ...rest } = node;
    return noiTiep === true ? { ...rest, attrs: { noiTiep: true } } : rest;
  }) as JSONContent;
}

/**
 * Nguoc lai toEditorDoc: attrs.noiTiep === true thanh noiTiep, moi attrs khac cua muc danh sach bi bo (trinh soan thao
 * sinh { noiTiep: null } cho moi muc). Dau ra van phai qua checkDraftInput nhu moi tai lieu tu trinh duyet.
 */
export function fromEditorDoc(json: JSONContent): unknown {
  return doi(structuredClone(json) as Nut, (node) => {
    if (node.type !== "listItem") return node;
    const { attrs, ...rest } = node;
    return attrs?.noiTiep === true ? { ...rest, noiTiep: true } : rest;
  });
}

/** Co media nao cua ban goc khong con trong tai lieu dang sua: dem theo id, nen bo A them B van la bo. */
export function droppedMedia(original: DocJson, current: JSONContent): boolean {
  const khoi = (current.content ?? []).filter((b): b is JSONContent & { type: string } => typeof b.type === "string");
  const con = new Set(mediaIdsOf({ content: khoi }));
  return mediaIdsOf(original).some((id) => !con.has(id));
}

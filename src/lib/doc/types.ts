import type { MediaNode } from "@/lib/media/node";

export type MarkType = "bold" | "italic" | "underline";
export type Mark = { type: MarkType };

export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type HardBreakNode = { type: "hardBreak" };
export type InlineNode = TextNode | HardBreakNode;

export type ParagraphNode = { type: "paragraph"; content?: InlineNode[] };
/**
 * Muc danh sach gom dung mot doan: khong long danh sach, khong nhieu doan trong mot muc
 * (trinh soan thao cung dat luat nay). Nho vay cat tai lieu thanh to o bat ky dong nao cung ra
 * cau truc hop le. noiTiep chi co tren to da dang: muc nay bat dau tu to truoc, nen man doc
 * khong ve lai dau cham.
 */
export type ListItemNode = { type: "listItem"; noiTiep?: true; content: [ParagraphNode] };
export type BulletListNode = { type: "bulletList"; content: ListItemNode[] };
/** Khoi chu: long duoc trong trich dan. Khoi media khong bao gio nam trong trich dan hay muc danh sach. */
export type TextBlockNode = ParagraphNode | BulletListNode | BlockquoteNode;
export type BlockquoteNode = { type: "blockquote"; content: TextBlockNode[] };
/** Khoi cap cao nhat cua tai lieu: khoi chu, hoac khoi media nguyen (anh, ghi am) chi nam o cap nay. */
export type BlockNode = TextBlockNode | MediaNode;

export type DocJson = { type: "doc"; content: BlockNode[] };

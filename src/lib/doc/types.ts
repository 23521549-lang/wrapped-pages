import type { MediaNode } from "@/lib/media/node";

export type MarkType = "bold" | "italic" | "underline";
export type Mark = { type: MarkType };

export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type HardBreakNode = { type: "hardBreak" };
export type InlineNode = TextNode | HardBreakNode;

/**
 * noiTiep chi co tren to da dang (dau do splitDoc dat): true la khoi nay bi cat ngang o cho ngat trang, phan dau cua
 * no nam o to truoc; false (chi o khoi dau cua to) la to bat dau dung bien khoi. Man doc chi dung dau true cua muc
 * danh sach (khong ve lai dau cham); joinSheets dung ca bon loai de noi lai.
 */
export type ParagraphNode = { type: "paragraph"; noiTiep?: boolean; content?: InlineNode[] };
/**
 * Muc danh sach gom dung mot doan: khong long danh sach, khong nhieu doan trong mot muc
 * (trinh soan thao cung dat luat nay). Nho vay cat tai lieu thanh to o bat ky dong nao cung ra
 * cau truc hop le.
 */
export type ListItemNode = { type: "listItem"; noiTiep?: boolean; content: [ParagraphNode] };
export type BulletListNode = { type: "bulletList"; noiTiep?: boolean; content: ListItemNode[] };
/** Khoi chu: long duoc trong trich dan. Khoi media khong bao gio nam trong trich dan hay muc danh sach. */
export type TextBlockNode = ParagraphNode | BulletListNode | BlockquoteNode;
export type BlockquoteNode = { type: "blockquote"; noiTiep?: boolean; content: TextBlockNode[] };
/** Khoi cap cao nhat cua tai lieu: khoi chu, hoac khoi media nguyen (anh, ghi am) chi nam o cap nay. */
export type BlockNode = TextBlockNode | MediaNode;

export type DocJson = { type: "doc"; content: BlockNode[] };

import type { Editor } from "@tiptap/core";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { MediaNode } from "@/lib/media/node";

/**
 * Giao dich chen mot khoi media. Khoi media chi o cap cao nhat, nen dung ngay sau khoi cap cao nhat dang
 * chua con tro (ca danh sach hay trich dan, hoac khoi media dang chon); con tro o mot doan trong thi khoi thay doan do.
 * Sau khi chen, con tro dung o dau doan ngay sau khoi; khoi sau khong phai doan thi tao mot doan trong, de go tiep duoc.
 */
export function insertMediaTr(state: EditorState, block: MediaNode): Transaction {
  const { doc, schema, selection } = state;
  const index = Math.min(selection.$from.index(0), doc.childCount - 1);
  const khoi = doc.child(index);
  const dau = selection.$from.posAtIndex(index, 0);
  const node = schema.nodes[block.type].create(block.attrs);
  const tr = state.tr;
  const thayDoanTrong = khoi.type.name === "paragraph" && khoi.content.size === 0;
  if (thayDoanTrong) tr.replaceWith(dau, dau + khoi.nodeSize, node);
  else tr.insert(dau + khoi.nodeSize, node);
  const sau = (thayDoanTrong ? dau : dau + khoi.nodeSize) + node.nodeSize;
  if (tr.doc.nodeAt(sau)?.type.name !== "paragraph") tr.insert(sau, schema.nodes.paragraph.create());
  return tr.setSelection(TextSelection.create(tr.doc, sau + 1)).scrollIntoView();
}

/** Chen khoi media vao man viet roi dua focus ve vung soan, ngay sau khoi vua chen. */
export function insertMediaBlock(editor: Editor, block: MediaNode): void {
  editor.view.dispatch(insertMediaTr(editor.state, block));
  editor.view.focus();
}

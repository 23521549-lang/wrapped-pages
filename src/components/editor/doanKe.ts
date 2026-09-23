import { Mark, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { SHELF_MARK } from "@/lib/doc/types";

/**
 * Dau "doan tren ke": nguoi viet boi den mot cau roi chon, khung sach o Ke sach lay dung doan do. Nam trong marks cua
 * nut chu nen di theo to qua splitDoc, publishDraft, joinSheets va editRound, khong can cot rieng.
 * Chi to mau nhat bang background-color va border-radius: moi thuoc tinh khac se doi hinh hoc cua dong chu, tuc doi
 * diem ngat trang - dieu tuyet doi khong duoc phep.
 * inclusive false: go chu ngay sau doan da chon thi khong dinh dau theo, vi day la mot doan cu the chu khong phai kieu
 * chu dang go.
 */
export const DoanKe = Mark.create({
  name: SHELF_MARK,
  inclusive: false,
  parseHTML() {
    return [{ tag: "span.doan-ke" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "doan-ke" }), 0];
  },
});

/**
 * Vung dang boi den co chu mang duoc dau hay khong. Khong rong thoi thi chua du: boi den mot khoi anh hay ghi am cung
 * la mot vung khong rong, ma dau chi bam vao duoc nut chu, nen khi do danh dau se khong doi gi ca.
 */
export function chonDuocDoanKe(state: EditorState): boolean {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  const kieu = state.schema.marks[SHELF_MARK];
  let co = false;
  state.doc.nodesBetween(from, to, (node, _pos, parent) => {
    if (node.isText && parent?.type.allowsMarkType(kieu)) co = true;
  });
  return co;
}

/** Con tro hay vung dang chon nam trong doan da danh dau. */
export function dangTrongDoanKe(state: EditorState): boolean {
  const kieu = state.schema.marks[SHELF_MARK];
  const { $from, from, to, empty } = state.selection;
  return empty ? kieu.isInSet($from.marks()) !== undefined : state.doc.rangeHasMark(from, to, kieu);
}

/**
 * Giao dich danh dau vung dang boi den. Moi tai lieu chi co MOT doan tren ke, nen dau cu bi go khoi ca tai lieu truoc
 * khi danh dau vung moi. Khong co chu nao de danh dau thi tra ve giao dich rong (khong sua gi).
 */
export function datDoanKeTr(state: EditorState): Transaction {
  const tr = state.tr;
  if (!chonDuocDoanKe(state)) return tr;
  const kieu = state.schema.marks[SHELF_MARK];
  const { from, to } = state.selection;
  tr.removeMark(0, state.doc.content.size, kieu);
  tr.addMark(from, to, kieu.create());
  return tr;
}

/** Giao dich bo dau o moi noi trong tai lieu. */
export function boDoanKeTr(state: EditorState): Transaction {
  return state.tr.removeMark(0, state.doc.content.size, state.schema.marks[SHELF_MARK]);
}

/** Dat hay bo dau roi dua focus ve vung soan, nhu insertMediaBlock lam voi khoi media. */
export function doiDoanKe(editor: Editor): void {
  const tr = dangTrongDoanKe(editor.state) ? boDoanKeTr(editor.state) : datDoanKeTr(editor.state);
  if (tr.docChanged) editor.view.dispatch(tr);
  editor.view.focus();
}

import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, type Selection } from "@tiptap/pm/state";
import { isMediaNodeType, MEDIA_NODE_TYPES, type MediaNodeType } from "@/lib/media/node";

/** Cau doc cho trinh doc man hinh, khong hien chu. */
const DA_CHON = {
  anh: "Đã chọn ảnh. Bấm Delete hoặc nút Bỏ ảnh để bỏ.",
  "ghi-am": "Đã chọn ghi âm. Bấm Delete hoặc nút Bỏ ghi âm để bỏ.",
} as const satisfies Record<MediaNodeType, string>;

const DA_BO = { anh: "Đã bỏ ảnh.", "ghi-am": "Đã bỏ ghi âm." } as const satisfies Record<MediaNodeType, string>;

export const DA_CHEN_GHI_AM = "Đã chèn ghi âm.";

function demMedia(doc: PMNode): Record<MediaNodeType, number> {
  const dem: Record<MediaNodeType, number> = { anh: 0, "ghi-am": 0 };
  doc.forEach((node) => {
    if (isMediaNodeType(node.type.name)) dem[node.type.name] += 1;
  });
  return dem;
}

/**
 * Cau doc sau mot giao dich doi tai lieu hay vung chon cua man viet: bot mot khoi media thi "Da bo ...", vung chon la mot
 * khoi media thi "Da chon ...", con lai chuoi rong (xoa vung doc de lan chon sau duoc doc lai). Media chi o cap cao nhat
 * nen chi dem con truc tiep cua tai lieu.
 */
export function mediaAnnouncement(before: PMNode, after: PMNode, selection: Selection): string {
  const truoc = demMedia(before);
  const sau = demMedia(after);
  const bo = MEDIA_NODE_TYPES.find((loai) => sau[loai] < truoc[loai]);
  if (bo) return DA_BO[bo];
  if (selection instanceof NodeSelection && isMediaNodeType(selection.node.type.name)) return DA_CHON[selection.node.type.name];
  return "";
}

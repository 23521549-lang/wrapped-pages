import TiptapStarterKit from "@tiptap/starter-kit";
import { ListItem } from "@tiptap/extension-list";
import { Node, type Extensions } from "@tiptap/core";
import { AudioBlockNode, ImageBlockNode } from "./mediaNodes";

/** Phan cua StarterKit khong dung: chi giu doan, chu, dam, nghieng, gach chan, danh sach cham, trich dan, xuong dong, hoan tac. */
const KHONG_DUNG = {
  heading: false,
  codeBlock: false,
  code: false,
  strike: false,
  horizontalRule: false,
  orderedList: false,
  link: false,
  dropcursor: false,
  gapcursor: false,
  trailingNode: false,
  listKeymap: false,
  listItem: false,
} as const;

// Muc danh sach gom dung mot doan: khong long danh sach, khong nhieu doan trong mot muc.
// Nho vay cat tai lieu thanh to o bat ky dong nao cung ra cau truc hop le (xem split.ts).
const MucMotDoan = ListItem.extend({ content: "paragraph" });

/** Muc danh sach cua man sua to: them dau noiTiep (lop noi-tiep, khong ve dau cham), nhu man doc ve to do. */
const MucNoiTiep = MucMotDoan.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      noiTiep: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.classList.contains("noi-tiep") ? true : null),
        renderHTML: (a: { noiTiep?: true | null }) => (a.noiTiep ? { class: "noi-tiep" } : {}),
      },
    };
  },
});

/**
 * Tai lieu man viet: khoi chu hoac khoi media o cap cao nhat. Trich dan (block+) va muc danh sach (paragraph) khong nhan
 * nhom media, nen khoi media khong bao gio long vao trong, dung nhu cleanDoc.
 */
const TaiLieuCoMedia = Node.create({ name: "doc", topNode: true, content: "(block | media)+" });

/**
 * So do trang tra loi: chi khoi chu va dinh dang ma checkReplyInput chap nhan. HTML khoi media dan vao bi bo vi
 * khong co luat doc nao khop. Them hay bot o day thi phai sua ca cleanDoc (co test doi chieu trong
 * tests/unit/editor-schema.test.ts).
 */
export const TEXT_EXTENSIONS: Extensions = [TiptapStarterKit.configure(KHONG_DUNG), MucMotDoan];

/**
 * So do man viet: dung cac khoi va dinh dang ma cleanDoc chap nhan, gom ca anh va ghi am o cap cao nhat. author la biet
 * danh nguoi viet, cho chu thay the va nhan cua khoi media. Them hay bot o day thi phai sua ca cleanDoc (co test doi chieu
 * trong tests/unit/editor-schema.test.ts).
 */
export function editorExtensions(author: string): Extensions {
  return cacPhan(author, MucMotDoan);
}

/**
 * So do man sua mot to da dang: y nhu man viet, chi khac muc danh sach mang duoc dau noiTiep cua to bat dau giua danh
 * sach (xem pageEdit.ts). Man viet khong dung so do nay, vi dau do chi co tren to da dang.
 */
export function pageEditExtensions(author: string): Extensions {
  return cacPhan(author, MucNoiTiep);
}

function cacPhan(author: string, muc: typeof MucMotDoan): Extensions {
  return [
    TiptapStarterKit.configure({ ...KHONG_DUNG, document: false }),
    muc,
    TaiLieuCoMedia,
    ImageBlockNode.configure({ author }),
    AudioBlockNode.configure({ author }),
  ];
}

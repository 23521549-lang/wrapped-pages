import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { AudioBlock } from "@/components/media/AudioBlock";
import { IconX } from "@/components/media/icons";
import { ImageBlock } from "@/components/media/ImageBlock";
import { cleanDoc } from "@/lib/doc/validate";
import { imageBox } from "@/lib/media/layout";
import { mediaSrc, type AudioAttrs, type ImageAttrs } from "@/lib/media/node";

export type MediaNodeOptions = {
  /** Biet danh nguoi viet: chu thay the cua anh va nhan cua ghi am trong man viet. */
  author: string;
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** Thuoc tinh chi nam trong tai lieu, khong tu ra HTML: renderHTML tu ve day du. */
const THUOC_TINH = { default: null, rendered: false } as const;

/**
 * Doc mot khoi media tu HTML (cat roi dan lai, chep giua hai the) va kiem bang chinh cleanDoc: thuoc tinh sai thi luat
 * doc khong khop, khoi bi bo thay vi lot vao tai lieu roi lam hong ban nhap.
 */
function khoiTuHtml(block: unknown) {
  return cleanDoc({ type: "doc", content: [block] })?.content[0];
}

function NutBo({ label, editor, deleteNode }: { label: string } & Pick<ReactNodeViewProps, "editor" | "deleteNode">) {
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm khoi-bo"
      onClick={() => {
        deleteNode();
        editor.commands.focus();
      }}
    >
      <IconX />
      {label}
    </button>
  );
}

function ImageView({ node, editor, extension, deleteNode }: ReactNodeViewProps) {
  const { id, w, h } = node.attrs as ImageAttrs;
  return (
    <NodeViewWrapper>
      <ImageBlock id={id} w={w} h={h} author={(extension.options as MediaNodeOptions).author}>
        <NutBo label="Bỏ ảnh" editor={editor} deleteNode={deleteNode} />
      </ImageBlock>
    </NodeViewWrapper>
  );
}

function AudioView({ node, editor, extension, deleteNode }: ReactNodeViewProps) {
  const { id, ms, peaks } = node.attrs as AudioAttrs;
  return (
    <NodeViewWrapper>
      <AudioBlock src={mediaSrc(id)} ms={ms} peaks={peaks} author={(extension.options as MediaNodeOptions).author}>
        <NutBo label="Bỏ ghi âm" editor={editor} deleteNode={deleteNode} />
      </AudioBlock>
    </NodeViewWrapper>
  );
}

/**
 * Khoi anh: nguyen tu, chi o cap cao nhat (nhom media, chi tai lieu nhan), chon duoc, khong keo tha. Thuoc tinh
 * dung nhu mo hinh tai lieu (id, w, h). renderHTML la cai bo do dung (DOMSerializer): hop giu cho SVG co dung imageBox,
 * khong tai anh, nen do khong can doi anh ve. Node view trong editor ve anh that bang ImageBlock cung kich thuoc.
 */
export const ImageBlockNode = Node.create<MediaNodeOptions>({
  name: "anh",
  group: "media",
  atom: true,
  selectable: true,
  draggable: false,
  addOptions() {
    return { author: "" };
  },
  addAttributes() {
    return { id: THUOC_TINH, w: THUOC_TINH, h: THUOC_TINH };
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-khoi="anh"]',
        getAttrs: (el) => {
          const block = khoiTuHtml({ type: "anh", attrs: { id: el.dataset.id, w: Number(el.dataset.w), h: Number(el.dataset.h) } });
          return block?.type === "anh" ? block.attrs : false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { id, w, h } = node.attrs as ImageAttrs;
    const { width, height } = imageBox({ w, h });
    return [
      "figure",
      { class: "khoi-anh", "data-khoi": "anh", "data-id": id, "data-w": String(w), "data-h": String(h) },
      [`${SVG_NS} svg`, { class: "khoi-anh__cho", width: String(width), height: String(height), "aria-hidden": "true" }],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

/**
 * Khoi ghi am: cung luat voi khoi anh, thuoc tinh id, ms, peaks. Cao co dinh bang token --khoi-ghi-am-h ca o ban sao do
 * lan node view, nen renderHTML chi can the figure dung lop.
 */
export const AudioBlockNode = Node.create<MediaNodeOptions>({
  name: "ghi-am",
  group: "media",
  atom: true,
  selectable: true,
  draggable: false,
  addOptions() {
    return { author: "" };
  },
  addAttributes() {
    return { id: THUOC_TINH, ms: THUOC_TINH, peaks: THUOC_TINH };
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-khoi="ghi-am"]',
        getAttrs: (el) => {
          let peaks: unknown;
          try {
            peaks = JSON.parse(el.dataset.peaks ?? "");
          } catch {
            return false;
          }
          const block = khoiTuHtml({ type: "ghi-am", attrs: { id: el.dataset.id, ms: Number(el.dataset.ms), peaks } });
          return block?.type === "ghi-am" ? block.attrs : false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { id, ms, peaks } = node.attrs as AudioAttrs;
    return ["figure", { class: "khoi-ghi-am", "data-khoi": "ghi-am", "data-id": id, "data-ms": String(ms), "data-peaks": JSON.stringify(peaks) }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioView);
  },
});

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type Break = { pos: number; height: number };

const key = new PluginKey<DecorationSet>("ngat-trang");

function khoiDem(height: number): HTMLElement {
  const el = document.createElement("span");
  el.className = "ngat-trang";
  el.style.height = `${height}px`;
  el.setAttribute("aria-hidden", "true");
  el.contentEditable = "false";
  return el;
}

/**
 * Ve khoi dem o moi cho ngat trang. Vi tri va chieu cao do usePagedLayout do roi day vao qua meta;
 * giua hai lan do, cac khoi dem troi theo chu nho DecorationSet.map.
 */
export const PageBreaks = Extension.create({
  name: "ngatTrang",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const breaks = tr.getMeta(key) as Break[] | undefined;
            if (breaks) {
              return DecorationSet.create(
                tr.doc,
                breaks.map((b) =>
                  Decoration.widget(b.pos, () => khoiDem(b.height), {
                    side: -1,
                    key: `ngat-${b.pos}-${b.height}`,
                    ignoreSelection: true,
                    stopEvent: () => true,
                  }),
                ),
              );
            }
            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
          },
        },
        props: {
          decorations: (state) => key.getState(state) ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

/** Day danh sach cho ngat moi vao editor. Giao dich chi co meta nen khong vao lich su hoan tac, khong phat su kien update. */
export function setBreaks(editor: Editor, breaks: Break[]): void {
  editor.view.dispatch(editor.state.tr.setMeta(key, breaks));
}

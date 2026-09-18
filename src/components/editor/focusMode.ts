import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Danh dau doan dang co con tro bang class "dang-viet", de CSS lam mo cac doan con lai. */
export const FocusMode = Extension.create({
  name: "tapTrung",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tap-trung"),
        props: {
          decorations(state) {
            const { $head } = state.selection;
            if ($head.depth === 0 || !$head.parent.isTextblock) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node($head.before(), $head.after(), { class: "dang-viet" }),
            ]);
          },
        },
      }),
    ];
  },
});

import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * So ky tu cua tai lieu dang soan, dem dung nhu docCharCount cua src/lib/doc/text.ts (moi nut chu tinh theo
 * do dai UTF-16, moi hardBreak tinh 1, khoi va dinh dang tinh 0) nhung duyet thang cay ProseMirror, khong phai
 * dung lai JSON o moi lan do.
 */
export function editorCharCount(doc: PMNode): number {
  let n = 0;
  doc.descendants((node) => {
    if (node.isText) n += node.textContent.length;
    else if (node.type.name === "hardBreak") n += 1;
  });
  return n;
}

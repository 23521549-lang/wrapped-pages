import type { Editor } from "@tiptap/core";
import { paginate } from "@/lib/paginate";
import { CONTENT_HEIGHT } from "@/lib/sheet";
import { trimTrailingBlank } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { measureUnits } from "./measure";
import { splitDoc } from "./split";

/**
 * Do tai lieu dang viet trong ban sao an, xep trang, cat thanh cac to va bo to trong o cuoi: dung mot duong cho man viet
 * (dang trang) va man sua luot (luu luot), nen ca hai cat ra dung cac to man doc se ve. Nem khi ban sao lech so doan voi
 * tai lieu hay cho ngat lam rong mot khoi; noi goi bao loi va de nguoi viet sua tiep.
 */
export function cutSheets(editor: Editor, mirror: HTMLElement): DocJson[] {
  const doc = editor.state.doc;
  const units = measureUnits(mirror, doc);
  const sheets = paginate(units, CONTENT_HEIGHT);
  return trimTrailingBlank(splitDoc(doc, sheets.slice(1).map((s) => units[s.from].pos)));
}

"use client";

import { useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { paginate, type Unit } from "@/lib/paginate";
import { CONTENT_HEIGHT } from "@/lib/sheet";
import { measureUnits } from "./measure";
import { useMeasure } from "./useMeasure";

export type OneSheet = {
  /** Chu tran sang to thu hai. */
  overflow: boolean;
  /** Chieu cao phan chu da do, px logic, tinh tu dinh vung chu. */
  contentHeight: number;
};

const VUA_TRONG: OneSheet = { overflow: false, contentHeight: 0 };

/** Tu cac don vi da do: co tran sang to thu hai khong, va phan chu cao bao nhieu. Ham thuan. */
export function oneSheetOf(units: readonly Unit[]): OneSheet {
  return {
    overflow: paginate(units, CONTENT_HEIGHT).length > 1,
    contentHeight: units.length > 0 ? units[units.length - 1].bottom : 0,
  };
}

/** Do ngay tren ban sao an. Nem khi ban sao lech so doan voi tai lieu; noi goi phai bat. */
export function measureOneSheet(editor: Editor, mirror: HTMLElement): OneSheet {
  return oneSheetOf(measureUnits(mirror, editor.state.doc));
}

/** Theo doi trang tra loi con vua mot to khong. Lich do va rao ghep chu la cua useMeasure, chung voi usePagedLayout. */
export function useOneSheet(editor: Editor | null, mirror: RefObject<HTMLDivElement | null>): OneSheet {
  const [fit, setFit] = useState<OneSheet>(VUA_TRONG);

  useMeasure(editor, mirror, (units) => {
    const next = oneSheetOf(units);
    setFit((old) => (old.overflow === next.overflow && old.contentHeight === next.contentHeight ? old : next));
  });

  return fit;
}

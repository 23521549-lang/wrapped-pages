"use client";

import { useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { paginate } from "@/lib/paginate";
import { CONTENT_HEIGHT, spacerHeight } from "@/lib/sheet";
import { editorCharCount } from "./charCount";
import { setBreaks, type Break } from "./pageBreaks";
import { useMeasure } from "./useMeasure";

/**
 * Do ban sao, xep trang, ve khoi dem vao editor. Lich do (cho CHO_MS, sau khi phong chu tai xong, khong bao
 * gio trong luc bo go dang ghep chu, nuot loi ban sao lech so doan) nam o useMeasure, dung chung voi
 * useOneSheet cua trang tra loi, de rao ghep chu chi co mot ban. Cung luot do dem luon so ky tu cua ca tai lieu
 * cho bo dem o dau man viet: khong them hen gio nao, va khong bao gio dem giua luc dang ghep chu.
 * afterMeasure (tuy chon) chay cuoi moi lan do, vi du de tinh lai so to se dang khi khung niem phong dang mo.
 * breaks: vi tri dau moi to tu to 2, de man sua luot dat con tro o dung to ?trang=.
 */
export function usePagedLayout(
  editor: Editor | null,
  mirror: RefObject<HTMLDivElement | null>,
  afterMeasure?: () => void,
): { sheetCount: number; chars: number; breaks: readonly number[] } {
  const [sheetCount, setSheetCount] = useState(1);
  const [chars, setChars] = useState(0);
  const [breakPos, setBreakPos] = useState<readonly number[]>([]);
  const last = useRef("");

  useMeasure(editor, mirror, (units, ed) => {
    const sheets = paginate(units, CONTENT_HEIGHT);
    const breaks: Break[] = sheets.slice(1).map((s, k) => ({
      pos: units[s.from].pos,
      height: spacerHeight(sheets[k].spaceLeft),
    }));
    const sig = JSON.stringify(breaks);
    if (sig !== last.current) {
      last.current = sig;
      setBreaks(ed, breaks);
      setBreakPos(breaks.map((b) => b.pos));
    }
    setSheetCount(sheets.length);
    setChars(editorCharCount(ed.state.doc));
    afterMeasure?.();
  });

  return { sheetCount, chars, breaks: breakPos };
}

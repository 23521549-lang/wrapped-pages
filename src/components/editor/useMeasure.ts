"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { Unit } from "@/lib/paginate";
import { measureUnits } from "./measure";

/** Cho bay nhieu ms sau lan doi cuoi cua tai lieu roi moi do lai. */
export const CHO_MS = 120;

/**
 * Lich do dung chung cua man viet (usePagedLayout) va trang tra loi (useOneSheet). Do ban sao an bang
 * measureUnits roi dua cac don vi cho onMeasure: ngay luc gan, sau khi phong chu tai xong, CHO_MS sau lan doi
 * cuoi, va CHO_MS sau khi bo go ket thuc ghep chu. Khong bao gio do trong luc bo go dang ghep chu
 * (editor.view.composing), de khong pha dau tieng Viet: dang ghep thi hen lai.
 *
 * run() chay tu setTimeout nen khong ai bat duoc loi nem tu day: loi cua measureUnits (ban sao lech so doan
 * voi tai lieu) hay cua onMeasure deu bi bo qua, giu ket qua cu; lan doi tiep theo se do lai.
 * onMeasure luon la ban cua lan render gan nhat; doi ham khong lam gan lai bo nghe.
 */
export function useMeasure(
  editor: Editor | null,
  mirror: RefObject<HTMLDivElement | null>,
  onMeasure: (units: Unit[], editor: Editor) => void,
): void {
  const latest = useRef(onMeasure);

  // Khai bao TRUOC hieu ung do: React chay hieu ung theo thu tu khai bao, nen lan do dau tien da thay ham moi.
  useEffect(() => {
    latest.current = onMeasure;
  });

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, CHO_MS);
    };

    function run() {
      if (!alive || !editor || !mirror.current) return;
      if (editor.view.composing) {
        schedule();
        return;
      }
      try {
        latest.current(measureUnits(mirror.current, editor.state.doc), editor);
      } catch {
        // Ban sao lech so doan hoac onMeasure nem: bo qua lan nay, lan doi sau cua tai lieu do lai.
      }
    }

    const dom = editor.view.dom;
    editor.on("update", schedule);
    dom.addEventListener("compositionend", schedule);
    void document.fonts.ready.then(() => {
      if (alive) run();
    });
    run();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      editor.off("update", schedule);
      dom.removeEventListener("compositionend", schedule);
    };
  }, [editor, mirror]);
}

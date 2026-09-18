"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { SHEET } from "@/lib/sheet";
import { useFitScale } from "@/components/sheet/useFitScale";

const BUOC = SHEET.height + SHEET.gap;

/**
 * Chong to giay phia sau, editor phia truoc, ca hai thu phong cung nhau; ban sao an de do thi khong thu phong.
 * Ba prop tuy chon cho trang tra loi; bo trong thi ve dung nhu man viet.
 */
export function PagedSurface({ editor, sheetCount, mirrorRef, height, numbered = true, children }: {
  editor: Editor | null;
  sheetCount: number;
  mirrorRef: RefObject<HTMLDivElement | null>;
  /** Chieu cao logic cua chong, px. Bo trong thi tinh tu sheetCount. */
  height?: number;
  /** Ve so to o chan moi to. Mac dinh co. */
  numbered?: boolean;
  /** Ve them sau editor, trong khung da thu phong (vi du vach Het trang cua trang tra loi). */
  children?: ReactNode;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  const k = useFitScale(fitRef, SHEET.width, 1.25);
  const cao = height ?? sheetCount * BUOC - SHEET.gap;

  return (
    <div className="viet-mat" ref={fitRef}>
      <div className="viet-chong" style={{ width: SHEET.width * k, height: cao * k }}>
        <div className="viet-chong__trong" style={{ height: cao, transform: `scale(${k})` }}>
          {Array.from({ length: sheetCount }, (_, i) => (
            <div key={i} className="to-giay viet-to" style={{ top: i * BUOC }} aria-hidden="true">
              {numbered && <span className="to-giay__so">{i + 1}</span>}
            </div>
          ))}
          <EditorContent editor={editor} className="viet-chu" />
          {children}
        </div>
      </div>
      <div ref={mirrorRef} className="giay-noi-dung ban-sao" aria-hidden="true" />
    </div>
  );
}

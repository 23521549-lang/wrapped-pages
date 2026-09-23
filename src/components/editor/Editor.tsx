"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useEditor } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { actionSaveDraft } from "@/app/actions/library";
import { charCountLabel } from "@/lib/doc/counter";
import { toPlainJson } from "@/lib/doc/plain";
import type { DocJson } from "@/lib/doc/types";
import { createAutosave, type SaveStatus } from "./autosave";
import { cutSheets } from "./cutSheets";
import { DoanKeButton } from "./DoanKeButton";
import { editorExtensions } from "./extensions";
import { FocusMode } from "./focusMode";
import { MediaTools } from "./MediaTools";
import { NONCE_TAI_LIEU } from "./nonce";
import { PageBreaks } from "./pageBreaks";
import { PagedSurface } from "./PagedSurface";
import { PublishButton, PublishPanel, usePublish } from "./PublishBar";
import { SaveBadge } from "./SaveBadge";
import { usePagedLayout } from "./usePagedLayout";

export type EditorProps = {
  bookId: string;
  bookTitle: string;
  /** Biet danh nguoi kia khi sach chia se, null khi rieng tu. */
  partnerNickname: string | null;
  initialDoc: DocJson;
  initialSavedAt: string | null;
  /** Biet danh nguoi viet (chu sach): chu thay the va nhan cua khoi media. */
  author: string;
  /** Kho media dang bat. Tat thi Them anh va Ghi am mo di, van Tab toi duoc, kem mot cau ghi chu. */
  mediaEnabled: boolean;
};

type Snapshot = { doc: unknown; sheets: number };

const KHOA_TAP_TRUNG = "mqce-tap-trung";

export function Editor({ bookId, bookTitle, partnerNickname, initialDoc, initialSavedAt, author, mediaEnabled }: EditorProps) {
  const [status, setStatus] = useState<SaveStatus | null>(
    initialSavedAt ? { kind: "da-luu", at: initialSavedAt } : null,
  );
  const [focus, setFocus] = useState(true);
  const editorRef = useRef<TiptapEditor | null>(null);
  const sheetCountRef = useRef(1);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const autosave = useMemo(
    () =>
      // oxlint-disable-next-line react/refs -- FALSE POSITIVE: `editorRef.current` chi duoc doc ben trong `take`, mot closure ma autosave chi goi luc autosave.take() thuc su chay (khi luu), khong phai luc useMemo nay dang tinh gia tri (luc render).
      createAutosave<Snapshot>({
        save: (s) => actionSaveDraft(bookId, s.doc, s.sheets),
        // toPlainJson: attrs cua khoi media trong getJSON() khong co prototype (xem src/lib/doc/plain.ts),
        // phai ep ve JSON thuan truoc khi roi trinh duyet di toi actionSaveDraft (Server Action).
        take: () => (editorRef.current ? { doc: toPlainJson(editorRef.current.getJSON()), sheets: sheetCountRef.current } : null),
        onStatus: setStatus,
      }),
    [bookId],
  );

  // Giu nguyen tham chieu giua cac lan render: useEditor so extensions theo tham chieu, mang moi thi goi setOptions moi lan.
  const extensions = useMemo(() => [...editorExtensions(author), PageBreaks, FocusMode], [author]);
  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: false,
    // TipTap chen mot the <style> luc chay (white-space: pre-wrap cua .ProseMirror, con tro gap...). Duoi CSP
    // ban phat hanh the do bi chan neu khong mang nonce cua tai lieu, va man viet mat het cach xuong dong. Luc
    // phat trien style-src la 'unsafe-inline' khong nonce (src/lib/csp.ts), nonce nay vo hai nhung khong can.
    injectNonce: NONCE_TAI_LIEU,
    editorProps: { attributes: { class: "giay-noi-dung", "aria-label": "Trang đang viết" } },
    onUpdate: () => autosave.changed(),
  });
  const prepare = useCallback((): { sheets: DocJson[] } | { error: string } => {
    const ed = editorRef.current;
    if (!ed || !mirrorRef.current) return { error: "Trang chưa sẵn sàng. Thử lại sau một giây." };
    let kept: DocJson[];
    try {
      // cutSheets co the nem khi ban sao do lech so doan voi tai lieu hay cho ngat lam rong mot khoi: phai nam trong
      // khoi try nay, khong de mot cu nem thoat thang vao onClick.
      kept = cutSheets(ed, mirrorRef.current);
    } catch {
      return { error: "Chưa cắt được trang. Thử sửa một chút rồi đăng lại." };
    }
    return kept.length > 0 ? { sheets: kept } : { error: "Trang còn trống, chưa có gì để đăng." };
  }, []);

  const beforePublish = useCallback(async () => {
    // Van sua duoc trong luc chon niem phong; chi khoa tu luc bam Dang, de ban nhap luu lan cuoi va cai
    // prepare() doc lai ngay sau day la mot, va khong co chu nao go trong luc dang gui bi mat.
    editorRef.current?.setEditable(false);
    await autosave.flush();
    // Tat, KHONG chi dispose(): cleanup luc redirect thoat component se goi flush() mot lan nua, va
    // neu bo tu luu con song thi lan flush do ghi lai ban nhap vua dang len database. Dang thanh cong
    // thi afterFail khong bao gio duoc goi, nen khong co resume() nao lam song lai duong nay; dang
    // hong thi afterFail se resume() vi luc do tu luu tiep la dieu dung phai lam.
    autosave.stop();
  }, [autosave]);

  const dang = usePublish({
    bookId,
    partnerNickname,
    prepare,
    beforePublish,
    afterFail: () => {
      // Dang hong: nguoi dung con o lai trang nen tu luu phai chay lai that su, khong chi
      // bao dirty suong - mo khoa vung soan thao, mo lai bo tu luu, roi bao co thay doi
      // chua luu de hen gio duoc dat ngay, khong phai cho den phim go tiep theo.
      editorRef.current?.setEditable(true);
      autosave.resume();
      autosave.changed();
    },
  });
  const nutDangRef = useRef<HTMLButtonElement>(null);

  // Xep trang xong ma khung niem phong dang mo (van sua duoc trang): tinh lai so to se dang.
  const { sheetCount, chars } = usePagedLayout(editor, mirrorRef, () => dang.refresh());
  const dem = charCountLabel(chars);
  // Vung doc chung cua man viet: chon, bo, chen khoi media va tien trinh tai anh.
  const [loiDoc, setLoiDoc] = useState("");

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    sheetCountRef.current = sheetCount;
  }, [sheetCount]);

  useEffect(() => {
    try {
      // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (localStorage): doc trang thai tap trung da luu tu lan truoc ngay sau khi mount, khong the doc luc render vi localStorage khong ton tai tren server.
      if (localStorage.getItem(KHOA_TAP_TRUNG) === "tat") setFocus(false);
    } catch {
      // Trinh duyet chan luu tru: giu mac dinh la bat.
    }
  }, []);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (autosave.isDirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      // Link cua Next dieu huong phia client, khong phat beforeunload: luu not phan chua luu truoc khi go.
      // TipTap hoan destroy() bang setTimeout, nen luc nay editor van doc duoc (kiem trong node_modules).
      void autosave.flush();
      autosave.dispose();
    };
  }, [autosave]);

  function doiTapTrung() {
    setFocus((f) => {
      try {
        localStorage.setItem(KHOA_TAP_TRUNG, f ? "tat" : "bat");
      } catch {
        // Khong luu duoc thi thoi, chi mat lua chon o lan sau.
      }
      return !f;
    });
  }

  return (
    <div className={["viet", focus && "tap-trung", dang.open && "viet--dang"].filter(Boolean).join(" ")}>
      <div className="viet-tren">
        <header className="viet-dau">
          <Link className="nav__link" href={`/sach/${bookId}`}>Về sách</Link>
          <h1 className="viet-dau__ten d">{bookTitle}</h1>
          <div className="viet-dau__phai">
            <span className="luu">{sheetCount} trang</span>
            {dem.kind === "gan" && <span className="luu dem-chu">{dem.text}</span>}
            <SaveBadge
              status={status}
              warning={dem.kind === "tran" ? dem.text : null}
              onRetry={() => void autosave.flush()}
            />
            <PublishButton flow={dang} ref={nutDangRef} />
          </div>
        </header>
        <MediaTools
          editor={editor}
          bookId={bookId}
          author={author}
          mediaEnabled={mediaEnabled}
          announce={setLoiDoc}
          extra={
            <>
              <DoanKeButton editor={editor} announce={setLoiDoc} />
              <button type="button" className="nut-dinh-dang nut-dinh-dang--chu" aria-pressed={focus} onClick={doiTapTrung}>
                Tập trung
              </button>
            </>
          }
        />
      </div>
      <div className="viet-than">
        {dang.open && (
          <PublishPanel
            flow={dang}
            bookTitle={bookTitle}
            partnerNickname={partnerNickname}
            onCancel={() => {
              flushSync(() => dang.cancel());
              nutDangRef.current?.focus();
            }}
          />
        )}
        <PagedSurface editor={editor} sheetCount={sheetCount} mirrorRef={mirrorRef} lat={dang.open} />
      </div>
      <p className="sr-only" aria-live="polite">{loiDoc}</p>
    </div>
  );
}

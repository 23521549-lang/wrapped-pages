"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { actionSubmitReply } from "@/app/actions/seal";
import type { DocJson } from "@/lib/doc/types";
import { SHEET } from "@/lib/sheet";
import { TEXT_EXTENSIONS } from "./extensions";
import { PagedSurface } from "./PagedSurface";
import { checkReply, keptText, readReplyDraft, REPLY_ERRORS, replyDraftKey } from "./replyDraft";
import { NONCE_TAI_LIEU } from "./nonce";
import { measureOneSheet, useOneSheet } from "./useOneSheet";

export type ReplyEditorProps = {
  sealId: string;
  bookId: string;
  bookTitle: string;
  /** Biet danh chu sach, nguoi dat cau hoi. */
  ownerName: string;
  question: string;
};

function luuTam(sealId: string, doc: JSONContent): void {
  try {
    sessionStorage.setItem(replyDraftKey(sealId), JSON.stringify(doc));
  } catch {
    // Trinh duyet chan luu tru: chi mat lop chong mat chu nay, van viet va gui duoc.
  }
}

function xoaTam(sealId: string): void {
  try {
    sessionStorage.removeItem(replyDraftKey(sealId));
  } catch {
    // Khong xoa duoc thi thoi: gui xong thi route nay 404, ban luu khong con hien o dau.
  }
}

/**
 * Trinh viet trang tra loi cua trao doi: dung mot to giay, khong tu luu len may chu. Tran sang to
 * hai thi khoa nut gui. Chong mat chu bang ban luu tam trong sessionStorage cua the dang mo
 * va canh bao beforeunload.
 */
export function ReplyEditor({ sealId, bookId, bookTitle, ownerName, question }: ReplyEditorProps) {
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mirrorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    // Trang tra loi chi co chu: so do khong co khoi media, dan vao cung bi bo.
    extensions: TEXT_EXTENSIONS,
    immediatelyRender: false,
    // Nhu o Editor.tsx: the <style> TipTap chen luc chay phai mang nonce cua tai lieu, khong thi CSP chan.
    injectNonce: NONCE_TAI_LIEU,
    editorProps: {
      attributes: { class: "giay-noi-dung", "aria-label": "Trang trả lời", "aria-describedby": "vua-trang" },
    },
    onCreate: ({ editor: ed }) => {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(replyDraftKey(sealId));
      } catch {
        // Trinh duyet chan luu tru: bat dau tu trang trong.
      }
      const doc = readReplyDraft(raw);
      // Khoi phuc ngoai lich su hoan tac: Ctrl+Z ngay sau do khong duoc xoa chu vua khoi phuc, roi ghi de ban luu.
      if (doc) ed.chain().setMeta("addToHistory", false).setContent(doc).run();
    },
    onUpdate: ({ editor: ed }) => luuTam(sealId, ed.getJSON()),
  });
  const fit = useOneSheet(editor, mirrorRef);
  const cao = Math.max(SHEET.height, SHEET.padTop + fit.contentHeight + SHEET.padBottom);

  useEffect(() => {
    if (!editor) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (editor.isDestroyed) return;
      const r = checkReply(editor.getJSON());
      if (r.ok || r.reason !== "blank") e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [editor]);

  /** Kiem dung nhu may chu (checkReply), roi do mot to. Tra tai lieu da lam sach de gui, hoac loi. */
  function kiem(): { doc: DocJson } | { error: string } {
    if (!editor || !mirrorRef.current) return { error: REPLY_ERRORS["not-ready"] };
    const checked = checkReply(editor.getJSON());
    if (!checked.ok) return { error: REPLY_ERRORS[checked.reason] };
    try {
      if (measureOneSheet(editor, mirrorRef.current).overflow) return { error: REPLY_ERRORS.overflow };
    } catch {
      return { error: REPLY_ERRORS["not-measured"] };
    }
    return { doc: checked.doc };
  }

  function open() {
    // Khoa TRUOC khi kiem: cai nguoi dung thay luc xac nhan chac chan la cai se duoc gui (nhu PublishBar).
    editor?.setEditable(false);
    const r = kiem();
    if ("error" in r) {
      setError(r.error);
      editor?.setEditable(true);
      return;
    }
    setError(null);
    setAsk(true);
  }

  function send() {
    const ed = editor;
    if (!ed) return;
    // Khoa o moi lan gui, khong chi luc mo hop: chu go trong luc cho action se khong duoc gui ma cung khong
    // duoc giu. Hop dang mo thi vung soan thao da khoa; khoa lai o day giu rao nay.
    ed.setEditable(false);
    startTransition(async () => {
      const draft = ed.getJSON();
      // Gui hong: giu ban luu tam, dong hop xac nhan roi moi mo khoa. Lan gui sau phai mo lai hop qua open(),
      // noi khoa va kiem lai tu dau.
      const hong = (loi: string) => {
        luuTam(sealId, draft);
        setError(loi);
        setAsk(false);
        ed.setEditable(true);
      };
      try {
        // Kiem lai ngay truoc khi gui, dan an toan neu lop khoa o tren sau nay bi go.
        const r = kiem();
        if ("error" in r) {
          hong(r.error);
          return;
        }
        xoaTam(sealId);
        const res = await actionSubmitReply(sealId, r.doc);
        if (res && "error" in res) hong(keptText(res.error));
      } catch (err) {
        // Gui thanh cong thi redirect() ben trong action nem loi dieu huong dac biet: phai de no di tiep cho Next.
        unstable_rethrow(err);
        hong(REPLY_ERRORS.offline);
      }
    });
  }

  return (
    <div className="viet">
      <div className="viet-tren">
        <header className="viet-dau">
          <Link className="nav__link" href={`/sach/${bookId}`}>Về sách</Link>
          <h1 className="viet-dau__ten d">Trang trả lời</h1>
          <div className="viet-dau__phai">
            {/* output mang san vai status: doi Vua mot trang / Da tran thi trinh doc man hinh doc lai. */}
            <output id="vua-trang" className={fit.overflow ? "vua-trang vua-trang--tran" : "vua-trang"}>
              {fit.overflow ? (
                <>
                  <span className="dau-loi" aria-hidden="true">!</span>Đã tràn sang trang 2, cần gọn lại
                </>
              ) : (
                "Vừa một trang"
              )}
            </output>
            {ask ? (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen, cung ly do voi PublishBar.
              <div className="dang-hoi" role="group" aria-label="Xác nhận gửi trả lời">
                <p className="dang-hoi__chu">Gửi xong thì cả hai trang cùng mở cho cả hai người.</p>
                <div className="dang-hoi__nut">
                  <button type="button" className="btn" disabled={pending} aria-busy={pending} onClick={send}>Gửi</button>
                  <button
                    type="button"
                    className="btn btn--line"
                    disabled={pending}
                    onClick={() => {
                      setAsk(false);
                      editor?.setEditable(true);
                    }}
                  >
                    Để sau
                  </button>
                </div>
              </div>
            ) : (
              <div className="dang">
                <button type="button" className="btn" disabled={fit.overflow} onClick={open}>Gửi trả lời</button>
                {error && <p className="luu luu--loi" role="alert">{error}</p>}
              </div>
            )}
          </div>
        </header>
      </div>

      <div className="tra-loi-dau">
        <div className="cau-hoi">
          <p className="cau-hoi__ai">{ownerName} hỏi</p>
          <p className="cau-hoi__chu">{question}</p>
        </div>
        <p className="meta">Trả lời trong đúng một trang · {bookTitle}</p>
      </div>

      <PagedSurface editor={editor} sheetCount={1} mirrorRef={mirrorRef} height={cao} numbered={false}>
        <div className="het-cho" data-hien={fit.overflow ? "co" : undefined} aria-hidden="true"><span>Hết trang</span></div>
      </PagedSurface>
    </div>
  );
}

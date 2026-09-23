"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEditor } from "@tiptap/react";
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import { actionEditRound } from "@/app/actions/library";
import { LUOT_VUA_SUA_NOI_KHAC } from "@/app/actions/messages";
import { charCountLabel, groupThousands } from "@/lib/doc/counter";
import { toPlainJson } from "@/lib/doc/plain";
import type { DocJson } from "@/lib/doc/types";
import { checkRoundInput, MAX_SHEETS_PER_PUBLISH, PUBLISH_TOTAL_MAX_CHARS } from "@/lib/doc/validate";
import { dateLabel, timeAgo } from "@/lib/when";
import { cutSheets } from "./cutSheets";
import { DoanKeButton } from "./DoanKeButton";
import { editorExtensions } from "./extensions";
import { MediaTools } from "./MediaTools";
import { NONCE_TAI_LIEU } from "./nonce";
import { PageBreaks } from "./pageBreaks";
import { PagedSurface } from "./PagedSurface";
import { droppedMedia, readRoundEditTemp, roundEditKey, roundEditTemp, staleRoundTempKeys } from "./roundEdit";
import { usePagedLayout } from "./usePagedLayout";

export type RoundEditorProps = {
  bookId: string;
  bookTitle: string;
  /** Ma luot dang sua, gui kem khi luu. */
  roundId: string;
  /** So thu tu cua luot trong cuon, tu 1. */
  ordinal: number;
  /** Vi tri to dau cua luot trong cuon: so in duoi to dau, va noi ve sau khi luu hay huy. */
  first: number;
  /** Cac to cua luot da noi thanh mot tai lieu (joinSheets). */
  initialDoc: DocJson;
  /** Moc phien ban (lan sua gan nhat, hay luc dang) dang ISO, gui lai nguyen van khi luu. */
  version: string;
  publishedAt: string;
  editedAt: string | null;
  /** Gio may chu luc ve trang, de dong phu ra cung chu o may chu va trinh duyet. */
  now: string;
  /** To thu may cua luot mo ngay khi vao (tu ?trang=), tu 1. */
  startSheet: number;
  /** Biet danh chu sach: chu thay the va nhan cua khoi media. */
  author: string;
  mediaEnabled: boolean;
};

/**
 * Hop xac nhan dang mo: bo thay doi de roi man (tu nut "Huy", hay tu lien ket "Ve sach"), hay bo thay doi de tai ban moi
 * sau khi luot vua duoc sua noi khac. Moi loai tra focus ve dung cho da mo hop.
 */
type Hoi = "huy" | "ve-sach" | "tai-lai";

const CAU_HOI = "Bỏ các thay đổi trong lượt này?";
// Tran chu cua mot luot dung bang tran cua mot lan dang (PUBLISH_TOTAL_MAX_CHARS), la con so checkRoundInput that su xet.
const TRAN_LUOT = `Vượt ${groupThousands(PUBLISH_TOTAL_MAX_CHARS)} ký tự, chưa lưu được. Bớt chữ rồi lưu lại.`;
const LOI = {
  trong: "Lượt phải còn ít nhất một trang không trống.",
  nhieu: `Mỗi lượt tối đa ${MAX_SHEETS_PER_PUBLISH} trang.`,
  dai: `Lượt dài quá ${groupThousands(PUBLISH_TOTAL_MAX_CHARS)} ký tự.`,
  hong: "Có trang có nội dung không đọc được.",
  chuaCat: "Chưa cắt được trang. Thử sửa một chút rồi lưu lại.",
  mang: "Chưa lưu được. Kiểm tra mạng rồi thử lại.",
} as const;
/** Khoang cach giu giua thanh tren dinh san va dinh to khi cuon toi to ?trang=, px. */
const CACH_TREN = 16;

function luuTam(khoa: string, version: string, doc: JSONContent): void {
  try {
    sessionStorage.setItem(khoa, roundEditTemp(version, doc, Date.now()));
  } catch {
    // Trinh duyet chan luu tru: chi mat lop chong mat chu nay, van sua va luu duoc.
  }
}

function xoaTam(khoa: string): void {
  try {
    sessionStorage.removeItem(khoa);
  } catch {
    // Khong xoa duoc thi thoi: ban tam chi khoi phuc khi moc phien ban con trung.
  }
}

/** Xoa ban tam cu cua cac luot khac va cua man sua mot to da bo (xem staleRoundTempKeys). */
function donTamCu(khoa: string): void {
  try {
    const cap: [string, string | null][] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k !== null) cap.push([k, sessionStorage.getItem(k)]);
    }
    for (const k of staleRoundTempKeys(cap, khoa, Date.now())) sessionStorage.removeItem(k);
  } catch {
    // Trinh duyet chan luu tru: khong co gi de don.
  }
}

/**
 * Man sua mot luot da dang: cac to cua luot noi thanh mot tai lieu tren trinh viet co ngat trang cua man viet, luu thi
 * cat lai bang dung duong cua man viet (cutSheets), nen man doc ngat trang dung nhu man sua cho thay. So to cua luot doi
 * duoc. Khong tu luu len may chu: chi "Luu thay doi" moi gui. Chong mat chu bang ban tam trong sessionStorage (chi khoi
 * phuc khi moc phien ban con trung) va canh bao beforeunload.
 */
export function RoundEditor({
  bookId, bookTitle, roundId, ordinal, first, initialDoc, version, publishedAt, editedAt, now, startSheet, author, mediaEnabled,
}: RoundEditorProps) {
  const router = useRouter();
  const khoa = roundEditKey(roundId);
  const veSach = `/sach/${bookId}?trang=${first}`;
  const [error, setError] = useState<string | null>(null);
  const [hoi, setHoi] = useState<Hoi | null>(null);
  const [khoiPhuc, setKhoiPhuc] = useState(false);
  const [boMedia, setBoMedia] = useState(false);
  const [loiDoc, setLoiDoc] = useState("");
  const [pending, startTransition] = useTransition();
  // Anh dang xu ly, tai len hay hop ghi am dang mo: chua chen xong, nen chua cho luu (khoi media khong roi vao giua luc luu).
  const [mediaBan, setMediaBan] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // Moc "chua doi gi": JSON cua trinh soan thao ngay sau khi tao, truoc khi khoi phuc ban tam.
  const gocRef = useRef<string | null>(null);
  // May chu da nhan xong ban sua (hay nguoi viet chon bo thay doi): roi trang luc nay khong phai mat chu. Dat khi da co
  // ket qua, khong phai luc vua gui: dang gui van la luc chu chi con o tab nay.
  const daGuiRef = useRef(false);
  // Da dat con tro va cuon toi to ?trang= mot lan: lan xep trang sau khong keo nguoi viet ve cho cu.
  const daMoToRef = useRef(false);
  const nutHuyRef = useRef<HTMLButtonElement>(null);
  const veSachRef = useRef<HTMLAnchorElement>(null);
  const nutTaiLaiRef = useRef<HTMLButtonElement>(null);
  const suaTiepRef = useRef<HTMLButtonElement>(null);

  // Giu nguyen tham chieu giua cac lan render: useEditor so extensions theo tham chieu.
  const extensions = useMemo(() => [...editorExtensions(author), PageBreaks], [author]);
  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: false,
    // Nhu Editor.tsx: the <style> TipTap chen luc chay phai mang nonce cua tai lieu, khong thi CSP chan.
    injectNonce: NONCE_TAI_LIEU,
    editorProps: { attributes: { class: "giay-noi-dung", "aria-label": "Lượt đang sửa" } },
    onCreate: ({ editor: ed }) => {
      gocRef.current = JSON.stringify(ed.getJSON());
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(khoa);
      } catch {
        // Trinh duyet chan luu tru: bat dau tu ban da dang.
      }
      donTamCu(khoa);
      const tam = readRoundEditTemp(raw, version);
      if (tam) {
        // Khoi phuc ngoai lich su hoan tac: Ctrl+Z ngay sau do khong duoc xoa chu vua khoi phuc.
        ed.chain().setMeta("addToHistory", false).setContent(tam).run();
        const khac = JSON.stringify(ed.getJSON()) !== gocRef.current;
        setKhoiPhuc(khac);
        if (!khac) xoaTam(khoa);
      } else if (raw !== null) {
        // Ban tam cua phien ban cu (luot vua duoc sua o noi khac) hay hong: khong bao gio dung toi nua.
        xoaTam(khoa);
      }
      // To dau: dat con tro o dau luot ngay. To sau: doi lan xep trang dau (hieu ung ben duoi) moi biet to do bat dau o dau.
      if (startSheet <= 1) ed.commands.focus("start");
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      if (JSON.stringify(json) === gocRef.current) xoaTam(khoa);
      else luuTam(khoa, version, toPlainJson(json));
      setBoMedia(droppedMedia(initialDoc, json));
    },
  });
  const { sheetCount, chars, breaks } = usePagedLayout(editor, mirrorRef);
  const dem = charCountLabel(chars, TRAN_LUOT, PUBLISH_TOTAL_MAX_CHARS);

  const daDoi = useCallback((ed: TiptapEditor) => gocRef.current !== null && JSON.stringify(ed.getJSON()) !== gocRef.current, []);

  useEffect(() => {
    if (!editor) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (editor.isDestroyed || daGuiRef.current) return;
      if (daDoi(editor)) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [editor, daDoi]);

  useEffect(() => {
    if (hoi) suaTiepRef.current?.focus();
  }, [hoi]);

  // Mo dung to ?trang=N cua luot: lan dau bo xep trang da cat du N to, dat con tro o dau to do roi cuon toi no. Cuon
  // tuc thoi (khong hoat anh), tru chieu cao thanh tren dang dinh san de dinh to khong nam duoi no.
  useEffect(() => {
    if (daMoToRef.current || !editor || startSheet <= 1 || breaks.length < startSheet - 1) return;
    daMoToRef.current = true;
    const pos = breaks[startSheet - 2];
    editor
      .chain()
      .command(({ tr }) => {
        tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), 1));
        return true;
      })
      .focus(null, { scrollIntoView: false })
      .run();
    const to = rootRef.current?.querySelectorAll<HTMLElement>(".viet-to")[startSheet - 1];
    const tren = rootRef.current?.querySelector<HTMLElement>(".viet-tren");
    if (to) window.scrollTo({ top: to.getBoundingClientRect().top + window.scrollY - (tren?.getBoundingClientRect().height ?? 0) - CACH_TREN });
  }, [editor, breaks, startSheet]);

  /** Cat lai cac to va kiem dung nhu actionEditRound. Tra cac to da lam sach de gui, hoac loi. */
  function kiem(ed: TiptapEditor): { sheets: DocJson[] } | { error: string } {
    if (!mirrorRef.current) return { error: LOI.chuaCat };
    let sheets: DocJson[];
    try {
      sheets = cutSheets(ed, mirrorRef.current);
    } catch {
      return { error: LOI.chuaCat };
    }
    if (sheets.length === 0) return { error: LOI.trong };
    if (sheets.length > MAX_SHEETS_PER_PUBLISH) return { error: LOI.nhieu };
    const checked = checkRoundInput(sheets);
    if (!checked.ok) return { error: checked.reason === "too-long" ? LOI.dai : LOI.hong };
    return { sheets: checked.sheets };
  }

  function luu() {
    const ed = editor;
    if (!ed) return;
    // Khoa TRUOC khi cat: cai duoc gui chac chan la cai dang hien tren to (nhu PublishBar).
    ed.setEditable(false, false);
    if (!daDoi(ed)) {
      xoaTam(khoa);
      router.push(veSach);
      return;
    }
    const r = kiem(ed);
    if ("error" in r) {
      setError(r.error);
      ed.setEditable(true, false);
      return;
    }
    setError(null);
    const draft = toPlainJson(ed.getJSON());
    // Hong thi ghi lai ban tam (no van con nguyen tu luc go, day chi la ghi de cho chac), hien loi, mo khoa: chu van
    // con de sua tiep hay luu lai.
    const hong = (loi: string) => {
      luuTam(khoa, version, draft);
      setError(loi);
      ed.setEditable(true, false);
    };
    // Chi goi khi may chu da nhan xong: TRUOC luc do ban tam va hang rao beforeunload phai con nguyen, khong thi dong
    // tab dung luc request dang bay se lam mat han chu ma khong hoi mot cau nao.
    const xongXuoi = () => {
      daGuiRef.current = true;
      xoaTam(khoa);
    };
    startTransition(async () => {
      try {
        const res = await actionEditRound(bookId, roundId, r.sheets, version);
        if (res?.error) hong(res.error);
        else xongXuoi();
      } catch (err) {
        try {
          // Luu thanh cong thi redirect() ben trong action nem loi dieu huong dac biet: phai de no di tiep cho Next.
          unstable_rethrow(err);
        } catch (dieuHuong) {
          // Loi dieu huong: action da luu xong va Next dang roi trang, gio moi den luot don ban tam.
          xongXuoi();
          throw dieuHuong;
        }
        hong(LOI.mang);
      }
    });
  }

  function huy() {
    if (editor && daDoi(editor)) setHoi("huy");
    else router.push(veSach);
  }

  /** Dong hop xac nhan, tra focus ve dung nut da mo no. */
  function dongHoi() {
    const moTu = hoi === "tai-lai" ? nutTaiLaiRef : hoi === "ve-sach" ? veSachRef : nutHuyRef;
    flushSync(() => setHoi(null));
    moTu.current?.focus();
  }

  function boThayDoi() {
    xoaTam(khoa);
    if (hoi === "tai-lai") {
      setHoi(null);
      // key={version} o trang: lam moi xong thi trinh soan thao dung lai tu ban moi nhat.
      router.refresh();
      return;
    }
    daGuiRef.current = true;
    router.push(veSach);
  }

  function dungBanDaDang() {
    if (!editor) return;
    editor.chain().setMeta("addToHistory", false).setContent(initialDoc, { emitUpdate: false }).run();
    xoaTam(khoa);
    setKhoiPhuc(false);
    setBoMedia(false);
  }

  const bayGio = new Date(now);
  const phu = `${bookTitle}, đăng ${dateLabel(new Date(publishedAt), bayGio)}${editedAt ? `, đã sửa ${timeAgo(new Date(editedAt), bayGio)}` : ""}`;

  return (
    <div className="viet" ref={rootRef}>
      <div className="viet-tren">
        <header className="viet-dau">
          <Link
            ref={veSachRef}
            className="nav__link"
            href={veSach}
            onClick={(e) => {
              // Nhu nut "Huy": dang luu thi dung yen (luu xong tu ve sach), da doi thi hoi truoc. Lien ket noi bo cua Next
              // khong phat beforeunload, nen khong co lop chan nao khac.
              if (pending) e.preventDefault();
              else if (editor && daDoi(editor)) {
                e.preventDefault();
                setHoi("ve-sach");
              }
            }}
          >
            Về sách
          </Link>
          <h1 className="viet-dau__ten d">Sửa lượt {ordinal}</h1>
          <p className="meta">{phu}</p>
          <div className="viet-dau__phai">
            <span className="luu">{sheetCount} trang</span>
            {dem.kind !== "an" && <span className={dem.kind === "tran" ? "luu dem-chu dem-chu--tran" : "luu dem-chu"}>{dem.text}</span>}
            {hoi ? (
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bat tren ca nhom de dong hop du focus dang o nut nao trong hop.
              <div
                className="dang-hoi"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen chi co hai nut, khong phai o nhap cua form; cung ly do voi PublishBar.
                role="group"
                aria-label={CAU_HOI}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  dongHoi();
                }}
              >
                <p className="dang-hoi__chu"><b>{CAU_HOI}</b></p>
                <div className="dang-hoi__nut">
                  <button ref={suaTiepRef} type="button" className="btn" onClick={dongHoi}>Sửa tiếp</button>
                  <button type="button" className="btn btn--line" onClick={boThayDoi}>
                    {hoi === "tai-lai" ? "Tải bản mới" : "Bỏ thay đổi"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="dang">
                <button type="button" className="btn" disabled={pending || mediaBan} aria-busy={pending || undefined} onClick={luu}>
                  Lưu thay đổi
                </button>
                <button ref={nutHuyRef} type="button" className="btn btn--line" disabled={pending} onClick={huy}>Hủy</button>
                {error && <p className="luu luu--loi" role="alert">{error}</p>}
                {error === LUOT_VUA_SUA_NOI_KHAC && (
                  <button ref={nutTaiLaiRef} type="button" className="btn btn--chu" onClick={() => setHoi("tai-lai")}>Tải lại</button>
                )}
              </div>
            )}
          </div>
        </header>
        <MediaTools
          editor={editor}
          bookId={bookId}
          author={author}
          mediaEnabled={mediaEnabled}
          announce={setLoiDoc}
          extra={<DoanKeButton editor={editor} announce={setLoiDoc} />}
          locked={pending}
          onBusyChange={setMediaBan}
        />
      </div>

      <div className="sua-ghi" aria-live="polite">
        {khoiPhuc && (
          <p className="sua-ghi__dong">
            <span>Đã khôi phục chữ đang sửa dở.</span>
            <button type="button" className="btn btn--chu" onClick={dungBanDaDang}>Dùng bản đã đăng</button>
          </p>
        )}
        {boMedia && <p className="field__help">Ảnh hoặc ghi âm bỏ khỏi lượt sẽ bị xóa hẳn sau khi lưu.</p>}
      </div>

      <PagedSurface editor={editor} sheetCount={sheetCount} mirrorRef={mirrorRef} firstNumber={first} />
      <p className="sr-only" aria-live="polite">{loiDoc}</p>
    </div>
  );
}

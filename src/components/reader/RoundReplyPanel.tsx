"use client";

import { useEffect, useId, useRef, useState, useTransition, type FocusEvent, type ReactNode } from "react";
import { actionSubmitRoundReply } from "@/app/actions/round-reply";
import { GlyphKhoa } from "@/components/book/ShelfBook";
import { normalizeReplyBody, REPLY_MAX, replyLength, shownRound, type ReplyRound } from "@/lib/round-reply";
import { pageRange } from "@/lib/seal/reader";
import { momentLabel } from "@/lib/when";
import { useShownRange } from "./ShownSheets";

export type RoundReplyPanelProps = {
  /** Cac luot cua cuon kem loi hoi dap (replyRounds), theo vi tri to. */
  rounds: ReplyRound[];
  /** Nguoi xem la chu sach: chi doc, khong co o chu. */
  mine: boolean;
  /** Biet danh nguoi hoi dap (nguoi khong phai chu sach), cho dong gio gui phia chu sach. */
  replierName: string;
  /** Gio may chu luc ve trang. */
  now: Date;
};

const DA_GUI = "Đã gửi lời hồi đáp.";
const MAT_MANG = "Chưa gửi được, thử lại nhé.";

/**
 * Dua focus toi mot phan tu cua khung roi keo no ra khoi cho the nhac dang dinh che (le cuon o giay.css). Trinh duyet
 * KHONG tinh le cuon khi tu cuon theo focus (do that o 1280x720: o chu van nam sau the nhac), nhung co tinh khi trang
 * goi scrollIntoView, nen goi them mot lan; "nearest" nen phan tu dang hien du cho thi khong cuon gi. jsdom khong co
 * ham nay, vi vay goi co dieu kien.
 */
function hienRa(el: HTMLElement | null): void {
  el?.focus();
  el?.scrollIntoView?.({ block: "nearest" });
}

/**
 * Bat moi duong focus con lai ma hienRa() khong voi toi: Shift+Tab tu nut Gui ve o chu, va lan khoi phuc vi tri cuon
 * cua App Router sau refresh(). Focus co noi bot trong React (onFocus o day thuc chat la focusin), nen mot handler
 * duy nhat tren section.hoi-dap phu moi phan tu con ben trong, khong can rai them hienRa() o tung noi. Goi sau khi
 * focus da toi noi nen scroll-margin-top cua giay.css duoc tinh dung; jsdom khong co scrollIntoView nen goi co dieu
 * kien.
 */
function onKhungFocus(e: FocusEvent<HTMLElement>): void {
  e.target.scrollIntoView?.({ block: "nearest" });
}

type FormProps = {
  roundId: string;
  chu: string;
  onChu: (chu: string) => void;
  onSent: () => void;
  onLoi: (loi: string | null) => void;
};

/**
 * O chu cua mot luot. Gan lai theo luot (key), nen hop hoi lai khong theo sang luot khac; chu dang go nam o khung cha
 * de lat qua lai khong mat. Bo dem dem chu da chuan hoa, dung so may chu kiem. Hop hoi lai mo thi o chu chi doc: chu
 * duoc hoi lai dung la chu se gui. Esc bat tren ca nhom .dang-hoi, khong bat tren o chu: luc hop mo thi focus nam o
 * mot trong hai nut cua hop, nen mot cho bat la du.
 */
function ReplyForm({ roundId, chu, onChu, onSent, onLoi }: FormProps) {
  const id = useId();
  const [hoi, setHoi] = useState(false);
  const [pending, startTransition] = useTransition();
  const oRef = useRef<HTMLTextAreaElement>(null);
  const xemLaiRef = useRef<HTMLButtonElement>(null);
  // Khoa mot lan gui: hai lan bam lien nhau (bam doi, hay Enter hai lan) den truoc khi lan ve voi pending kip hien
  // len, nen nut chua kip mo. Khoa mo lai khi lan gui do hong; gui duoc thi o chu bien mat cung khung.
  const dangGui = useRef(false);
  const dem = replyLength(normalizeReplyBody(chu));
  const tran = dem > REPLY_MAX;

  // Nut Gui vua roi khoi DOM: focus sang nut an toan cua hop hoi lai (gui roi khong sua duoc).
  useEffect(() => {
    if (hoi) xemLaiRef.current?.focus();
  }, [hoi]);

  function moHoi() {
    const loi = dem === 0 ? "Viết vài chữ rồi hãy gửi nhé." : tran ? `Dài quá ${REPLY_MAX} ký tự rồi, bớt một chút nhé.` : null;
    onLoi(loi);
    if (loi !== null) {
      hienRa(oRef.current);
      return;
    }
    setHoi(true);
  }

  function xemLai() {
    setHoi(false);
    hienRa(oRef.current);
  }

  function hong(loi: string) {
    dangGui.current = false;
    onLoi(loi);
    setHoi(false);
    hienRa(oRef.current);
  }

  function gui() {
    if (dangGui.current) return;
    dangGui.current = true;
    startTransition(async () => {
      try {
        const r = await actionSubmitRoundReply(roundId, chu);
        if ("error" in r) hong(r.error);
        else onSent();
      } catch {
        hong(MAT_MANG);
      }
    });
  }

  return (
    <div className="hoi-dap__form">
      <div className="field">
        <label className="field__label" htmlFor={`${id}-o`}>Viết lời hồi đáp</label>
        <textarea
          ref={oRef}
          id={`${id}-o`}
          className="input input--nhieu hoi-dap__o"
          value={chu}
          readOnly={hoi || pending}
          aria-describedby={`${id}-dem`}
          onChange={(e) => onChu(e.target.value)}
        />
        <p id={`${id}-dem`} className={tran ? "hoi-dap__dem hoi-dap__dem--tran" : "hoi-dap__dem"}>{dem}/{REPLY_MAX}</p>
      </div>
      {hoi ? (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bat tren ca nhom de dong hop du focus dang o nut nao trong hop.
        <div
          className="dang-hoi"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen chi co hai nut, khong phai o nhap cua form; cung ly do voi PublishBar.
          role="group"
          aria-label="Xác nhận gửi lời hồi đáp"
          onKeyDown={(e) => {
            if (e.key !== "Escape" || pending) return;
            e.preventDefault();
            xemLai();
          }}
        >
          <p className="dang-hoi__chu"><b>Gửi rồi sẽ không sửa được.</b></p>
          <div className="dang-hoi__nut">
            <button type="button" className="btn btn--sm" disabled={pending} aria-busy={pending || undefined} onClick={gui}>Gửi</button>
            <button ref={xemLaiRef} type="button" className="btn btn--line btn--sm" disabled={pending} onClick={xemLai}>Xem lại</button>
          </div>
        </div>
      ) : (
        <div className="hoi-dap__nut">
          <button type="button" className="btn btn--sm" onClick={moHoi}>Gửi</button>
        </div>
      )}
    </div>
  );
}

/**
 * Khung "Loi hoi dap" o cot phai man doc, theo luot cua to dang hien (to ben phai khi hai trang thuoc hai luot).
 * Nguoi doc: o chu, hoi lai truoc khi gui; luot con niem phong thi mot dong nhac; da gui thi loi cua minh kem gio.
 * Chu sach: loi hoi dap kem gio, hoac "Chua co loi hoi dap.". Loi cua may chu va cau bao cho trinh doc man hinh deu
 * mang theo ma luot va bi bo han khi lat sang luot khac: cho do tro ve rong ngay trong lan ve doi luot, va lat quay
 * lai cung khong doc lai cau cu. Vung aria-live co tu lan ve dau nen trinh doc man hinh doc duoc cau bao gui xong.
 */
export function RoundReplyPanel({ rounds, mine, replierName, now }: RoundReplyPanelProps) {
  const tieuDe = useId();
  const shown = useShownRange() ?? { first: 1, last: 1 };
  const luot = shownRound(rounds, shown);
  const [nhap, setNhap] = useState<Record<string, string>>({});
  const [loi, setLoi] = useState<{ roundId: string; text: string } | null>(null);
  const [bao, setBao] = useState<{ roundId: string; text: string } | null>(null);
  // Luot cua lan ve truoc, chi de biet luc nao vua doi luot (React goi lai ngay, khong ve them mot lan ra man hinh).
  const [luotTruoc, setLuotTruoc] = useState<string | null>(null);
  const loiRef = useRef<HTMLElement>(null);
  // Luot vua gui: refresh() cua action mang loi hoi dap ve thi dua focus toi loi do, vi nut Gui da roi khoi DOM.
  const vuaGui = useRef<string | null>(null);

  useEffect(() => {
    if (vuaGui.current === null || luot?.id !== vuaGui.current || luot.reply === null) return;
    vuaGui.current = null;
    hienRa(loiRef.current);
  }, [luot]);

  // Lat sang luot khac thi bo han cau bao va loi cua luot truoc, khong chi giau di theo ma luot: lat quay lai luot vua
  // gui ma chu con trong vung aria-live thi trinh doc man hinh doc lai no, nghe nhu vua gui them mot lan nua.
  const luotId = luot?.id ?? null;
  if (luotTruoc !== luotId) {
    setLuotTruoc(luotId);
    setLoi(null);
    setBao(null);
  }

  if (!luot) return null;
  const id = luot.id;

  let noiDung: ReactNode;
  if (luot.reply !== null) {
    noiDung = (
      <figure ref={loiRef} className="hoi-dap__loi" tabIndex={-1}>
        <blockquote className="hoi-dap__chu">{luot.reply.body}</blockquote>
        <figcaption className="meta">
          {mine ? replierName : "Bạn"} gửi <time dateTime={luot.reply.at.toISOString()}>{momentLabel(luot.reply.at, now)}</time>
        </figcaption>
      </figure>
    );
  } else if (mine) {
    noiDung = <p className="hoi-dap__trong">Chưa có lời hồi đáp.</p>;
  } else if (luot.sealed) {
    noiDung = <p className="hoi-dap__trong"><GlyphKhoa />Mở niêm phong để hồi đáp.</p>;
  } else {
    noiDung = (
      <ReplyForm
        key={id}
        roundId={id}
        chu={nhap[id] ?? ""}
        onChu={(chu) => setNhap((x) => ({ ...x, [id]: chu }))}
        onLoi={(text) => setLoi(text === null ? null : { roundId: id, text })}
        onSent={() => {
          vuaGui.current = id;
          setNhap((x) => {
            const con = { ...x };
            delete con[id];
            return con;
          });
          setLoi(null);
          setBao({ roundId: id, text: DA_GUI });
        }}
      />
    );
  }

  return (
    // onFocus o day khong bat tuong tac chuot/phim, chi keo phan tu con vua nhan focus ra khoi cho the nhac ghim
    // (xem chu thich cua onKhungFocus).
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section className="hoi-dap" aria-labelledby={tieuDe} onFocus={onKhungFocus}>
      <div className="hoi-dap__dau">
        <h2 className="d hoi-dap__t" id={tieuDe}>Lời hồi đáp</h2>
        <p className="meta">Dành cho {pageRange(luot.first, luot.last)}</p>
      </div>
      {noiDung}
      {loi !== null && loi.roundId === id && <p className="form__loi" role="alert">{loi.text}</p>}
      <p className="sr-only hoi-dap__bao" aria-live="polite">{bao !== null && bao.roundId === id ? bao.text : ""}</p>
    </section>
  );
}

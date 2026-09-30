"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { actionGuiThu } from "@/app/actions/thu";
import { normalizeReplyBody, replyLength } from "@/lib/round-reply";
import { THU_TOI_DA } from "@/lib/thu";
import { chimDenLay } from "./chim";

const MAT_MANG = "Chưa gửi được thư, thử lại nhé.";

/**
 * To giay de viet thu thang cho nguoi kia (spec 5b E1, F1): o chu co ke dong, bo dem ky tu da chuan hoa (dung so may chu
 * kiem), hoi lai truoc khi gui ("Gửi rồi sẽ không sửa được, và bạn cũng không xem lại được thư của mình"). Gui xong: to
 * giay gap thanh phong bi, chim sa xuong ngam di, roi moi goi daGui (trang lam moi sau khi chim bay xong). Hop hoi lai mo
 * thi o chu chi doc: chu duoc hoi lai dung la chu se gui; Esc hay "Xem lại" la quay lai o chu.
 */
export function VietThu({ thang, tenKia, tenThangChu, daGui }: {
  /** YYYY-MM. */
  thang: string;
  tenKia: string;
  /** "tháng Chín". */
  tenThangChu: string;
  daGui: () => void;
}) {
  const id = useId();
  const [chu, setChu] = useState("");
  const [hoi, setHoi] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const laRef = useRef<HTMLDivElement>(null);
  const oRef = useRef<HTMLTextAreaElement>(null);
  const xemLaiRef = useRef<HTMLButtonElement>(null);
  const dangGui = useRef(false);
  const dem = replyLength(normalizeReplyBody(chu));
  const tran = dem > THU_TOI_DA;

  useEffect(() => {
    if (hoi) xemLaiRef.current?.focus();
  }, [hoi]);

  function moHoi() {
    const x = dem === 0 ? "Viết vài dòng rồi hãy gửi nhé." : tran ? `Dài quá ${THU_TOI_DA} ký tự rồi, bớt một chút nhé.` : null;
    setLoi(x);
    if (x !== null) {
      oRef.current?.focus();
      return;
    }
    setHoi(true);
  }

  function xemLai() {
    setHoi(false);
    oRef.current?.focus();
  }

  function hong(x: string) {
    dangGui.current = false;
    setLoi(x);
    setHoi(false);
    oRef.current?.focus();
  }

  function gui() {
    if (dangGui.current) return;
    dangGui.current = true;
    startTransition(async () => {
      try {
        const r = await actionGuiThu(thang, chu);
        if ("error" in r) {
          hong(r.error);
          return;
        }
        if (laRef.current) await chimDenLay(laRef.current);
        daGui();
      } catch {
        hong(MAT_MANG);
      }
    });
  }

  return (
    <div className="thu-la thu-la--viet" ref={laRef} aria-busy={pending || undefined}>
      <p className="thu-la__gui">{`Gửi ${tenKia},`}</p>
      <label className="sr-only" htmlFor={`${id}-o`}>{`Thư của bạn gửi ${tenKia}`}</label>
      <textarea
        ref={oRef}
        id={`${id}-o`}
        value={chu}
        readOnly={hoi || pending}
        placeholder={`Vài dòng về ${tenThangChu} của hai người`}
        aria-describedby={`${id}-dem${loi === null ? "" : ` ${id}-loi`}`}
        onChange={(e) => setChu(e.target.value)}
      />
      {loi !== null && <p id={`${id}-loi`} className="form__loi" role="alert">{loi}</p>}
      <div className="thu-la__nut">
        <span id={`${id}-dem`} className={tran ? "thu-la__dem thu-la__dem--tran" : "thu-la__dem"}>{`${dem}/${THU_TOI_DA}`}</span>
        {!hoi && <button type="button" className="btn" onClick={moHoi}>Gửi thư</button>}
      </div>
      {hoi && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bat tren ca nhom de quay lai o chu du focus dang o nut nao trong hop.
        <div
          className="thu-la__hoi"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen chi co hai nut, cung ly do voi RoundReplyPanel.
          role="group"
          aria-label="Xác nhận gửi thư"
          onKeyDown={(e) => {
            if (e.key !== "Escape" || pending) return;
            e.preventDefault();
            xemLai();
          }}
        >
          <p>Gửi rồi sẽ không sửa được, và bạn cũng không xem lại được thư của mình.</p>
          <div>
            <button ref={xemLaiRef} type="button" className="btn btn--line btn--sm" disabled={pending} onClick={xemLai}>Xem lại</button>
            <button type="button" className="btn btn--sm" disabled={pending} aria-busy={pending || undefined} onClick={gui}>Gửi</button>
          </div>
        </div>
      )}
    </div>
  );
}

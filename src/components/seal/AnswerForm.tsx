"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { actionAnswer } from "@/app/actions/seal";
import { SEAL_LIMITS, type ReaderSeal } from "@/lib/seal/types";
import { useTimeLeft } from "./useTimeLeft";

type Ket = Awaited<ReturnType<typeof actionAnswer>> | null;

/** So phut con cho, lam tron len, it nhat 1. */
function phutCho(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

/**
 * Chu cho vung thong bao cua trinh doc man hinh. Dang cho thi so phut tinh voi now luc bat dau cho (noi goi
 * truyen now luc gan), nen khong doi moi phut; khong cho thi loi cua lan gui (neu co) kem so lan con lai.
 */
export function answerNote(seal: Pick<ReaderSeal, "remaining" | "lockedUntil">, now: Date, error: string | null): string {
  if (seal.lockedUntil !== null) return `Thử lại sau ${phutCho(seal.lockedUntil.getTime() - now.getTime())} phút`;
  return `${error ? `${error} ` : ""}Còn ${seal.remaining ?? 0} lần`;
}

/**
 * O tra loi cau do cua nguoi kia. Kiem dap an nam het o may chu: sai thi action lam moi man
 * doc, props moi mang goi y vua mo va so lan con lai; dung thi action tu chuyen trang. Chi hien so lan con
 * lai va thoi gian con cho, khong bao gio hien dieu luat.
 *
 * Noi goi gan lai component nay (key) moi khi bat dau hay het khoang cho, nen state cua useActionState va
 * now luc gan chi thuoc mot khoang. Dong chu duoi form khong phai vung thong bao (so phut doi moi phut); chu
 * bao duoc day len qua onNote cho mot vung dung yen o noi goi, nam ngoai key.
 */
export function AnswerForm({ seal, now, onNote }: {
  seal: Pick<ReaderSeal, "id" | "hints" | "remaining" | "lockedUntil">;
  now: Date;
  onNote: (note: string) => void;
}) {
  const id = useId();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<Ket, FormData>(async (_prev, fd) => actionAnswer(seal.id, fd), null);
  const cho = useTimeLeft(seal.lockedUntil, now, () => router.refresh());
  // now luc gan: router.refresh() dua now moi xuong nhung chu bao cua khoang cho nay giu nguyen.
  const [nowLucGan] = useState(now);
  const dangCho = seal.lockedUntil !== null;
  const note = answerNote(seal, nowLucGan, state?.error ?? null);

  useEffect(() => {
    // Ket qua cua action chi co sau khi commit, nen chu bao duoc day len vung thong bao o day.
    onNote(note);
  }, [note, onNote]);

  return (
    <>
      {seal.hints.length > 0 && (
        <div className="goi-y-ds">
          {seal.hints.map((h, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- goi y chi duoc may chu them vao cuoi theo so lan sai, khong chen, xoa hay sap lai, nen chi so on dinh; hai goi y co the trung chu.
            <div key={i} className="goi-y">
              <p className="goi-y__nhan">Gợi ý {i + 1}</p>
              <p className="goi-y__chu">{h}</p>
            </div>
          ))}
        </div>
      )}
      <form className="tra-loi" action={formAction}>
        <label className="sr-only" htmlFor={`${id}-tl`}>Câu trả lời</label>
        {/* Dang gui chi readOnly: disabled se day focus ra khoi o. Nut mac dinh bi khoa nen Enter khong gui lai. */}
        <input
          id={`${id}-tl`}
          className="input"
          name="guess"
          type="text"
          maxLength={SEAL_LIMITS.guessMax}
          placeholder="Viết câu trả lời"
          autoComplete="off"
          required
          readOnly={pending}
          disabled={dangCho}
        />
        <button type="submit" className="btn" disabled={dangCho || pending} aria-busy={pending}>Mở trang</button>
      </form>
      {dangCho ? (
        <p className="con-lan con-lan--cho">Thử lại sau {phutCho(cho)} phút</p>
      ) : (
        <p className="con-lan">
          {state?.error ? `${state.error} ` : ""}Còn <b>{seal.remaining ?? 0} lần</b>
        </p>
      )}
    </>
  );
}

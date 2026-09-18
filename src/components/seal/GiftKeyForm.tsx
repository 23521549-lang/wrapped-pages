"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { actionGiftKey } from "@/app/actions/seal";
import { SEAL_LIMITS } from "@/lib/seal/types";

type Ket = Awaited<ReturnType<typeof actionGiftKey>> | null;

type Props = { sealId: string; partner: string; range: string };

/**
 * Form loi nhan. useActionState nam o day chu khong o GiftKeyForm, va form duoc gan lai o moi lan mo (key),
 * nen loi cua lan gui truoc khong hien lai sau khi bam De sau roi mo lai.
 */
function GiftNoteForm({ sealId, partner, range, onClose }: Props & { onClose: () => void }) {
  const id = useId();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, pending] = useActionState<Ket, FormData>(async (_prev, fd) => actionGiftKey(sealId, fd), null);

  useEffect(() => {
    noteRef.current?.focus();
  }, []);

  return (
    <form className="tang-khoa" action={formAction}>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-nhan`}>Lời nhắn cho {partner}</label>
        {/* Dang gui chi readOnly de o khong mat focus; hai nut moi bi khoa. */}
        <textarea
          ref={noteRef}
          id={`${id}-nhan`}
          name="note"
          className="input input--nhieu"
          maxLength={SEAL_LIMITS.giftNoteMax}
          aria-describedby={`${id}-ghi`}
          readOnly={pending}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !pending) onClose();
          }}
        />
        <p className="field__help" id={`${id}-ghi`}>Không bắt buộc. {partner} đọc được {range} ngay khi bạn tặng.</p>
      </div>
      <div className="thu-thach__nut">
        <button type="submit" className="btn btn--sm" disabled={pending} aria-busy={pending}>Tặng chìa khóa</button>
        <button type="button" className="btn btn--quiet btn--sm" disabled={pending} onClick={onClose}>Để sau</button>
      </div>
      {state?.error && <p className="form__loi" role="alert">{state.error}</p>}
    </form>
  );
}

/**
 * Chu sach tang chia khoa kem loi nhan. Xac nhan noi tuyen: nut mo mot form nho ngay tai cho,
 * khong mo hop thoai. Thanh cong thi action tu chuyen trang, may chu mo trang cho nguoi kia.
 */
export function GiftKeyForm({ sealId, partner, range }: Props) {
  const [open, setOpen] = useState(false);
  // So lan da mo: lam key cua form, va cho biet da tung mo de tra focus ve nut khi dong.
  const [lanMo, setLanMo] = useState(0);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open && lanMo > 0) toggleRef.current?.focus();
  }, [open, lanMo]);

  if (!open) {
    return (
      <div className="thu-thach__nut">
        <button
          ref={toggleRef}
          type="button"
          className="btn"
          onClick={() => {
            setLanMo((n) => n + 1);
            setOpen(true);
          }}
        >
          Tặng chìa khóa
        </button>
      </div>
    );
  }

  return <GiftNoteForm key={lanMo} sealId={sealId} partner={partner} range={range} onClose={() => setOpen(false)} />;
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { actionRename } from "@/app/actions/identity";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";

type Ket = Awaited<ReturnType<typeof actionRename>> | null;

export function RenameForm() {
  const [state, formAction, pending] = useActionState<Ket, FormData>(
    async (_prev, fd) => actionRename(fd),
    null,
  );
  // Doi ten xoay mat khau cua nguoi kia ngay lap tuc va mat khau moi
  // chi hien mot lan, nen bat xac nhan hai buoc truoc khi gui form that su.
  const [dangXacNhan, setDangXacNhan] = useState(false);

  // Doi xong thi dong lai buoc xac nhan, de lan doi tiep theo bat dau tu dau.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (ket qua useActionState tra ve tu server action): chi biet doi ten thanh cong sau khi `state` cap nhat tu server, khong the doc luc dang render.
    if (state && "password" in state) setDangXacNhan(false);
  }, [state]);

  function dongXacNhan() {
    setDangXacNhan(false);
  }

  return (
    <form action={formAction} className="form">
      <Field
        label="Biệt danh mới cho người kia"
        name="nickname"
        maxLength={20}
        required
        onChange={dongXacNhan}
      />
      <Field
        label="Lời nhắn bí mật mới"
        name="secret"
        minLength={4}
        maxLength={500}
        required
        onChange={dongXacNhan}
      />

      {dangXacNhan ? (
        <div className="dang-hoi">
          <p className="dang-hoi__chu">
            Đổi xong, <b>mật khẩu cũ của người kia hết dùng được</b>. Mật khẩu mới chỉ hiện một lần, nhớ chép gửi ngay.
          </p>
          <div className="dang-hoi__nut">
            <Button type="submit" className="btn--sm" disabled={pending}>Xác nhận đổi</Button>
            <Button type="button" className="btn--quiet btn--sm" onClick={dongXacNhan}>Quay lại</Button>
          </div>
        </div>
      ) : (
        <div className="form__nut">
          <Button type="button" onClick={() => setDangXacNhan(true)}>Đổi tên</Button>
        </div>
      )}

      <p aria-live="polite" className="form__loi">
        {state && "error" in state ? state.error : ""}
      </p>
      {state && "password" in state && (
        <div className="muc">
          <p className="muc__x">Mật khẩu mới của người kia. Gửi cho họ, nó chỉ hiện một lần.</p>
          <p className="mat-khau" data-testid="mat-khau-moi">{state.password}</p>
        </div>
      )}
    </form>
  );
}

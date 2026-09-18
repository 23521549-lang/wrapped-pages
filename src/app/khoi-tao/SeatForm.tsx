"use client";

import { useActionState } from "react";
import { actionCreateSeat } from "@/app/actions/identity";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";

type Ket = Awaited<ReturnType<typeof actionCreateSeat>> | null;

const LOI_MO: Record<"mo-dau" | "dap-le", string> = {
  "mo-dau": "Bạn không tạo tài khoản cho mình. Bạn đặt tên cho người kia, rồi người kia đặt tên lại cho bạn.",
  "dap-le": "Giờ tới lượt bạn đặt tên cho người đã đặt tên cho bạn.",
};

export function SeatForm({ luot }: { luot: "mo-dau" | "dap-le" }) {
  const [state, formAction, pending] = useActionState<Ket, FormData>(
    async (_prev, fd) => actionCreateSeat(fd),
    null,
  );

  return (
    <main className="shell shell--hep man">
      <div className="head">
        <div>
          <h1 className="d">Đặt tên</h1>
          <p className="head__sub">{LOI_MO[luot]}</p>
        </div>
      </div>
      <div className="muc">
        <form action={formAction} className="form">
          <Field label="Biệt danh bạn đặt cho người kia" name="nickname" maxLength={20} required />
          <Field label="Lời nhắn bí mật gửi họ" name="secret" minLength={4} maxLength={500} required />
          <div className="form__nut">
            <Button type="submit" disabled={pending}>Tạo tài khoản</Button>
          </div>
          <p aria-live="polite" className="form__loi">
            {state && "error" in state ? state.error : ""}
          </p>
        </form>
      </div>
    </main>
  );
}

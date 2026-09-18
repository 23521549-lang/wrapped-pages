"use client";

import { useActionState } from "react";
import { actionLogin } from "@/app/actions/identity";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";

type Ket = Awaited<ReturnType<typeof actionLogin>> | null;

export function LoginForm() {
  const [state, formAction, pending] = useActionState<Ket, FormData>(
    async (_prev, fd) => actionLogin(fd),
    null,
  );

  return (
    <main className="shell shell--hep man">
      <div className="head">
        <div>
          <h1 className="d">Đăng nhập</h1>
        </div>
      </div>
      <div className="muc">
        <form action={formAction} className="form">
          <Field label="Mật khẩu người kia gửi cho bạn" name="password" autoComplete="off" required />
          <div className="form__nut">
            <Button type="submit" disabled={pending}>Vào</Button>
          </div>
          <p aria-live="polite" className="form__loi">
            {state?.error ?? ""}
          </p>
        </form>
      </div>
    </main>
  );
}

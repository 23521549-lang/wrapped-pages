"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/uuid";
import { db, getServerKey } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { createSeat, readSeatState, mayCreateNextSeat, SeatsFullError } from "@/server/identity/accounts";
import { parseNameInput } from "@/server/identity/input";
import { login } from "@/server/identity/login";
import { renamePartner, revealSecret } from "@/server/identity/rename";
import { createSession } from "@/server/identity/session";
import { currentAccount, getDeviceId, setFounderCookie, setSessionCookie } from "@/server/web/cookies";

export async function actionCreateSeat(formData: FormData) {
  const input = parseNameInput(formData);
  if ("error" in input) return input;

  const state = await readSeatState(db);
  if (!mayCreateNextSeat(state, await currentAccount())) {
    return {
      error: state.phase === "du-hai"
        ? "Web đã đủ hai người, không tạo thêm được."
        : "Bạn cần đăng nhập trước khi đặt tên cho người kia.",
    };
  }

  const deviceId = await getDeviceId();
  let seat: 1 | 2;
  try {
    ({ seat } = await createSeat(db, { ...input, deviceId, serverKey: getServerKey() }));
  } catch (e) {
    // Hai nguoi cung tao mot cho ngoi cung luc: rang buoc unique chan lai, bao than thien.
    if (isUniqueViolation(e)) return { error: "Có người vừa tạo trước bạn. Hãy đăng nhập." };
    if (e instanceof SeatsFullError) {
      return { error: "Web đã đủ hai người, không tạo thêm được." };
    }
    // Moi loi khac, vi du thieu SERVER_KEY, phai lo ra chu khong duoc giau.
    throw e;
  }
  if (seat === 1) await setFounderCookie();
  // Khong tra ket qua ve client. Trang /khoi-tao render lai nhu mot phan cua response
  // server action nay, va rao mayCreateNextSeat cua no gio da lat - no se nuot mat ket qua.
  // Man ket qua nam o route rieng, dung lai mat khau tu du lieu da luu.
  redirect("/khoi-tao/xong");
}

export async function actionLogin(formData: FormData) {
  const password = String(formData.get("password") ?? "").trim();
  const deviceId = await getDeviceId();
  const r = await login(db, { password, deviceId });

  if (!r.ok) {
    const message = {
      "sai-mat-khau": "Mật khẩu không đúng.",
      "bi-khoa": "Tạm khóa đăng nhập. Thử lại sau 15 phút.",
      // Noi that: khoa chung keo dai chung nao con nguoi do mat khau, khong hua mot moc gio chac chan.
      "khoa-chung": "Vừa có nhiều lần gõ sai mật khẩu từ các trình duyệt lạ, nên web tạm chặn mọi trình duyệt chưa từng đăng nhập ở đây. Nếu có máy bạn đã từng đăng nhập, hãy vào từ máy đó. Không thì thử lại sau một giờ; nếu có người đang dò mật khẩu thì có thể phải chờ lâu hơn.",
      "nguoi-tao-khong-duoc-vao": "Đây là tài khoản bạn tạo cho người kia, bạn không vào được.",
    }[r.reason];
    return { error: message };
  }

  await setSessionCookie(await createSession(db, r.accountId));
  redirect("/");
}

export async function actionRename(formData: FormData) {
  const me = await currentAccount();
  if (!me) return { error: "Bạn cần đăng nhập trước." };
  const input = parseNameInput(formData);
  if ("error" in input) return input;
  const state = await readSeatState(db);
  if (state.phase !== "du-hai") return { error: "Người kia chưa có tài khoản." };

  const { password } = await renamePartner(db, {
    actorAccountId: me.accountId, ...input, serverKey: getServerKey(),
  });
  refresh();
  return { password };
}

export async function actionReveal(formData: FormData) {
  const me = await currentAccount();
  if (!me) return;
  const historyId = String(formData.get("historyId") ?? "");
  if (!isUuid(historyId)) return;
  const state = await readSeatState(db);
  if (state.phase !== "du-hai") return;
  await revealSecret(db, { actorAccountId: me.accountId, historyId });
  refresh();
}

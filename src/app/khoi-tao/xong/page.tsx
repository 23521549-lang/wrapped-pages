import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { db, getServerKey } from "@/server/db";
import { readSeatState } from "@/server/identity/accounts";
import { recoverCreatedSeat } from "@/server/identity/recover";
import { readDeviceId } from "@/server/web/cookies";

// Mot rao redirect o cap trang khong duoc phu thuoc vao trang thai ma server
// action cua chinh trang do lam thay doi. actionCreateSeat redirect thang toi day
// va man ket qua nay dung lai mat khau tu du lieu da luu, thay vi cho no di qua
// state cua client - state do bi chinh lan render lai cua Server Action nuot mat.
export default async function Xong() {
  await connection();
  const deviceId = await readDeviceId();
  const found = deviceId ? await recoverCreatedSeat(db, { deviceId, serverKey: getServerKey() }) : null;
  if (!found) redirect("/");

  const state = await readSeatState(db);

  return (
    <main className="shell shell--hep man">
      <div className="head">
        <div>
          <h1 className="d">Đã xong</h1>
          <p className="head__sub">Gửi mật khẩu này cho người kia. Mở lại trang này là thấy lại.</p>
        </div>
      </div>
      <div className="muc">
        <p className="mat-khau" data-testid="mat-khau">{found.password}</p>
        {state.phase !== "du-hai" ? (
          <p className="muc__x">Bạn chưa có tài khoản. Chờ người kia đặt tên lại cho bạn.</p>
        ) : (
          <>
            <p className="muc__x">Giờ cả hai đã có tài khoản.</p>
            <div className="form__nut">
              <Link href="/ke-sach" className="btn">Vào kệ sách</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

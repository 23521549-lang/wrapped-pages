import { connection } from "next/server";
import { requireMe } from "@/server/web/guard";
import { readSettingsView } from "@/server/web/settings";
import { actionReveal } from "@/app/actions/identity";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/Button";
import { RenameForm } from "./RenameForm";

const ngay = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

/** Bo cuc: cung khung voi ke sach, hai cot, gap mot cot tu 820px tro xuong. */
export default async function CaiDat() {
  await connection();
  const me = await requireMe();
  const { nickname, written, received } = await readSettingsView(me.accountId);

  return (
    <>
      <AppNav me={me} current="cai-dat" />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Cài đặt</h1>
          </div>
        </div>

        <div className="cai-dat">
          <div className="cai-dat__cot">
            <section className="muc" aria-labelledby="cai-dat-ten">
              <h2 className="d muc__t" id="cai-dat-ten">Tên của bạn</h2>
              <p className="muc__x"><b>{nickname}</b>. Tên này do người kia đặt, bạn không tự đổi được.</p>
            </section>

            <section className="muc" aria-labelledby="cai-dat-doi">
              <h2 className="d muc__t" id="cai-dat-doi">Đặt lại tên</h2>
              <p className="muc__x">Đổi biệt danh hoặc lời nhắn sẽ đổi luôn mật khẩu của người kia. Nhớ gửi mật khẩu mới cho họ.</p>
              <RenameForm />
            </section>
          </div>

          <div className="cai-dat__cot">
            <section className="muc" aria-labelledby="cai-dat-viet">
              <h2 className="d muc__t" id="cai-dat-viet">Lời nhắn bạn đã viết</h2>
              {written.length === 0 ? (
                <p className="muc__x">Bạn chưa viết lời nhắn nào.</p>
              ) : (
                <ul className="nhan-ds">
                  {written.map((h) => (
                    <li key={h.id} className="nhan-cu">
                      <p className="nhan-cu__chu">{h.secret}</p>
                      <p className="meta">Biệt danh lúc đó: {h.nickname} · {ngay.format(h.createdAt)}</p>
                      {h.revealed ? (
                        <span className="chip chip--key">Đã gửi cho họ</span>
                      ) : (
                        <form action={actionReveal} className="nhan-cu__gui">
                          <input type="hidden" name="historyId" value={h.id} />
                          <p className="meta">Họ chưa đọc được. Gửi rồi thì họ đọc được mãi mãi.</p>
                          <Button type="submit" className="btn--sm">Gửi lời nhắn</Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="muc" aria-labelledby="cai-dat-nhan">
              <h2 className="d muc__t" id="cai-dat-nhan">Họ gửi bạn</h2>
              {received.length === 0 ? (
                <p className="muc__x">Chưa có lời nhắn nào được gửi cho bạn.</p>
              ) : (
                <ul className="nhan-ds">
                  {received.map((m, i) => (
                    // oxlint-disable-next-line react/no-array-index-key -- man nay render server-side moi lan tai trang, khong sap xep/them/xoa muc phia client nen index on dinh.
                    <li key={i} className="loi-nhan">
                      <p className="loi-nhan__chu">{m.secret}</p>
                      <p className="loi-nhan__ai">{ngay.format(m.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

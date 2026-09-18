"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { actionPublish } from "@/app/actions/library";
import type { DocJson } from "@/lib/doc/types";
import { parseSealInput } from "@/lib/seal/input";
import { SealPicker } from "./SealPicker";
import { blankAnswerIds, emptySeal, localInputValue, sealPayload, type SealChoice, type SealDraft } from "./sealDraft";

type Props = {
  bookId: string;
  bookTitle: string;
  partnerNickname: string | null;
  /** Do va xep trang lan cuoi, cat tai lieu thanh cac to (da bo to trong o cuoi). */
  prepare: () => { sheets: DocJson[] } | { error: string };
  /** Khoa vung soan thao ngay khi mo hop xac nhan: cai nguoi dung thay trong hop phai la cai se duoc dang. */
  lock: () => void;
  /** Tra lai sua duoc: huy xac nhan, hoac prepare() dau tien that bai nen hop khong mo. */
  unlock: () => void;
  /** Luu nhap lan cuoi va tat hen gio tu luu. */
  beforePublish: () => Promise<void>;
  /** Dang hong thi mo lai vung soan thao va cho tu luu chay lai. */
  afterFail: () => void;
};

const KHONG_LOI: ReadonlySet<number> = new Set();

/**
 * Phan giua va phan sau cua cau xac nhan, doi theo loai niem phong. Loai "khong"
 * giu nguyen cau xac nhan goc. Khong co biet danh (sach rieng tu) thi chi con khong hoac hen gio, va
 * biet danh chi duoc chen vao cau khi no that su co.
 */
function cauXacNhan(kind: SealChoice, partnerNickname: string | null): { giua: string; sau: string } {
  if (!partnerNickname) {
    return kind === "hen-gio"
      ? { giua: ", hẹn giờ mở", sau: "Tới giờ đó bạn mới đọc lại được." }
      : { giua: "", sau: "Chỉ mình bạn đọc được." };
  }
  if (kind === "cau-do") return { giua: ", đóng bằng câu đố", sau: `${partnerNickname} cần trả lời đúng mới đọc được.` };
  if (kind === "trao-doi") return { giua: ", đóng bằng trao đổi", sau: `${partnerNickname} cần viết một trang trả lời mới đọc được.` };
  if (kind === "hen-gio") return { giua: ", hẹn giờ mở", sau: "Tới giờ đó cả hai mới đọc được." };
  return { giua: "", sau: `${partnerNickname} sẽ đọc được.` };
}

/**
 * Nut Dang trang va cau hoi xac nhan noi tuyen, noi ro so trang, ten sach, ai se doc duoc, va niem phong
 * neu nguoi viet chon mot loai.
 */
export function PublishBar({ bookId, bookTitle, partnerNickname, prepare, lock, unlock, beforePublish, afterFail }: Props) {
  const [ask, setAsk] = useState<DocJson[] | null>(null);
  const [seal, setSeal] = useState<SealDraft>(emptySeal);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<ReadonlySet<number>>(KHONG_LOI);
  const [minMo, setMinMo] = useState("");
  const [pending, startTransition] = useTransition();
  const hopRef = useRef<HTMLDivElement>(null);

  /** Hien mot loi chung (null la xoa) va bo moi dong dang bi danh dau loi. */
  function baoLoi(msg: string | null) {
    setError(msg);
    setInvalid(KHONG_LOI);
  }

  function open() {
    // Khoa TRUOC khi doc tai lieu de xep to: tu day nguoi dung khong the go them nua, nen cai ho thay
    // trong hop xac nhan chac chan la cai se duoc dang (lop 1).
    lock();
    const r = prepare();
    if ("error" in r) {
      setError(r.error);
      setAsk(null);
      unlock();
      return;
    }
    baoLoi(null);
    // min cua o ngay gio mo: cong 2 phut de sau khi cat toi phut van con sau luc nay it nhat 1 phut.
    setMinMo(localInputValue(new Date(Date.now() + 2 * 60_000)));
    setAsk(r.sheets);
  }

  function publish() {
    // Kiem niem phong TRUOC khi cham toi ban nhap: sai thi hop van mo, vung soan thao van khoa, beforePublish
    // chua chay nen tu luu khong bi tat va khong co gi can afterFail. May chu kiem lai tu dau trong
    // actionPublish; lop nay chi de bao loi som va ro.
    const payload = sealPayload(seal);
    if ("error" in payload) {
      baoLoi(payload.error);
      return;
    }
    const sai = blankAnswerIds(seal);
    if (sai.size > 0) {
      // May chu chac chan tu choi dong chi co dau cau. Bao ngay tai dong do nhu mot o bi loi, roi
      // dua focus toi dong loi dau tien de trinh doc man hinh doc cau bao qua aria-describedby.
      flushSync(() => {
        setError(null);
        setInvalid(sai);
      });
      hopRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
      return;
    }
    // Dong ho o day la cua trinh duyet. Trinh duyet lech gio voi may chu thi hai ben co the ket luan khac nhau
    // quanh moc 1 phut cua hen gio; chap nhan vi chi co hai nguoi dung. May chu la noi quyet: dung noi long
    // hay bo lop nay de "sua" mot loi hen gio ma may chu tra ve.
    const checked = parseSealInput(payload.seal, partnerNickname === null ? "rieng-tu" : "chia-se", new Date());
    if (!checked.ok) {
      baoLoi(checked.error);
      return;
    }
    baoLoi(null);
    startTransition(async () => {
      await beforePublish();
      try {
        // Chay lai prepare() sau beforePublish(), dung ket qua moi nay de dang thay vi "ask" da chup tu
        // luc mo hop: day la lop an toan thu hai (cai thay trong hop la cai duoc dang), dung ngay ca khi lop khoa vung soan thao (lock/
        // unlock o tren) sau nay bi go hoac co ke ho nao khac len duoc.
        const fresh = prepare();
        if ("error" in fresh) {
          setError(fresh.error);
          afterFail();
          return;
        }
        const r = await actionPublish(bookId, fresh.sheets, payload.seal);
        if (r && "error" in r) {
          setError(r.error);
          afterFail();
        }
      } catch (err) {
        // actionPublish thanh cong thi redirect() ben trong nem mot loi dieu huong dac biet: phai de no
        // di tiep cho Next xu ly, khong duoc nuot. Loi khac (mat mang, ham nguoi lanh) moi la
        // that bai that su can bao cho nguoi dung va mo lai man hinh.
        unstable_rethrow(err);
        setError("Mất kết nối lúc đăng trang. Kiểm tra mạng rồi thử lại.");
        afterFail();
      }
    });
  }

  if (ask) {
    const cau = cauXacNhan(seal.kind, partnerNickname);
    return (
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan, khong phai nhom dieu khien form hay noi dung tai lieu; khong tag ngu nghia nao trong danh sach de xuat khop dung.
      <div ref={hopRef} className="dang-hoi dang-hoi--niem" role="group" aria-label="Xác nhận đăng trang">
        <p className="dang-hoi__chu">
          Đăng <b>{ask.length} trang</b> vào <b>{bookTitle}</b>{cau.giua}?{" "}{cau.sau}
        </p>
        <SealPicker
          partnerNickname={partnerNickname}
          value={seal}
          onChange={(next) => {
            setSeal(next);
            baoLoi(null);
          }}
          disabled={pending}
          minOpensAt={minMo}
          invalidAnswerIds={invalid}
        />
        {/* Loi chung dat ngay tren hai nut, sat cac o vua dien, khong nam cuoi mot hop dang cuon. */}
        {error && <p className="luu luu--loi" role="alert">{error}</p>}
        <div className="dang-hoi__nut">
          <button type="button" className="btn" disabled={pending} onClick={publish}>Đăng</button>
          <button
            type="button"
            className="btn btn--line"
            disabled={pending}
            onClick={() => {
              setAsk(null);
              baoLoi(null);
              unlock();
            }}
          >
            Để sau
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dang">
      <button type="button" className="btn" onClick={open}>Đăng trang</button>
      {error && <p className="luu luu--loi" role="alert">{error}</p>}
    </div>
  );
}

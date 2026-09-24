"use client";

import { useEffect, useId, useRef, useState, useTransition, type Ref } from "react";
import { flushSync } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { actionPublish } from "@/app/actions/library";
import { BookEditFields, useBookEdit, type BookNow } from "@/components/book/BookEditFields";
import { parseBookEdit } from "@/lib/book";
import type { DocJson } from "@/lib/doc/types";
import { parseSealInput } from "@/lib/seal/input";
import { luaChon, SealFields, SealKinds } from "./SealPicker";
import { blankAnswerIds, emptySeal, localInputValue, sealPayload, type SealChoice, type SealDraft } from "./sealDraft";

export type PublishDeps = {
  bookId: string;
  partnerNickname: string | null;
  /** Gia tri hien tai cua cuon cho muc "Doi bia, ten, nhac"; null la cuon chua co to nao (khong co muc do). */
  bookNow: BookNow;
  /** Kho media dang bat: tat thi khong tai bia moi len duoc, bia anh cu van hien. */
  mediaEnabled: boolean;
  /** Do va xep trang lan cuoi, cat tai lieu thanh cac to (da bo to trong o cuoi). */
  prepare: () => { sheets: DocJson[] } | { error: string };
  /** Khoa vung soan thao, luu nhap lan cuoi va tat hen gio tu luu. */
  beforePublish: () => Promise<void>;
  /** Dang hong thi mo lai vung soan thao va cho tu luu chay lai. */
  afterFail: () => void;
};

/** So to se duoc dang neu bam Dang luc nay, hoac ly do chua dang duoc. Tinh lai moi lan xep trang. */
type SanSang = { count: number } | { error: string };

const KHONG_LOI: ReadonlySet<number> = new Set();

/**
 * Phan giua va phan sau cua cau xac nhan, doi theo loai niem phong. Phan giua noi vao cau "Dang N trang vao
 * Ten sach"; phan sau la cau ghi duoi ten loai o cot giua. Khong co biet danh (sach rieng tu) thi chi con khong
 * hoac hen gio, va biet danh chi duoc chen vao cau khi no that su co.
 */
export function cauXacNhan(kind: SealChoice, partnerNickname: string | null): { giua: string; sau: string } {
  if (!partnerNickname) {
    return kind === "hen-gio"
      ? { giua: ", hẹn giờ mở", sau: "Tới giờ đó bạn mới đọc lại được." }
      : { giua: ", chỉ mình bạn đọc được", sau: "Chỉ mình bạn đọc được." };
  }
  if (kind === "cau-do") return { giua: ", khóa bằng câu đố", sau: `${partnerNickname} cần trả lời đúng mới đọc được.` };
  if (kind === "trao-doi") {
    return { giua: `, mở khi ${partnerNickname} viết trang trả lời`, sau: `${partnerNickname} cần viết một trang trả lời mới đọc được.` };
  }
  if (kind === "hen-gio") return { giua: ", hẹn giờ mở", sau: "Tới giờ đó cả hai mới đọc được." };
  return { giua: `, ${partnerNickname} đọc được ngay`, sau: `${partnerNickname} sẽ đọc được.` };
}

/**
 * Trang thai cua buoc dang trang: mo, niem phong dang soan, loi, so to se dang. Tach khoi phan ve vi nut "Dang
 * trang" nam o thanh tren con khung chon niem phong nam ben canh to giay. Vung soan thao van sua duoc trong luc
 * chon niem phong; so to tinh lai qua refresh() moi lan xep trang, va lop an toan thuc su van la prepare() chay
 * lai sau beforePublish() trong publish().
 */
export function usePublish({ bookId, partnerNickname, bookNow, mediaEnabled, prepare, beforePublish, afterFail }: PublishDeps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<SanSang>({ count: 0 });
  const [seal, setSeal] = useState<SealDraft>(emptySeal);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<ReadonlySet<number>>(KHONG_LOI);
  const [minMo, setMinMo] = useState("");
  const [pending, startTransition] = useTransition();
  const [doiMo, setDoiMo] = useState(false);
  // Trang thai cua ba o luon duoc dung (hook khong duoc goi co dieu kien); chi khi bookNow khac null moi co muc gap.
  const doi = useBookEdit(bookNow);

  /** Hien mot loi chung (null la xoa) va bo moi dong dang bi danh dau loi. */
  function baoLoi(msg: string | null) {
    setError(msg);
    setInvalid(KHONG_LOI);
  }

  /** Mo khung niem phong. Tra false (va bao loi canh nut) khi chua co gi de dang. */
  function start(): boolean {
    const r = prepare();
    if ("error" in r) {
      setError(r.error);
      return false;
    }
    baoLoi(null);
    // min cua o ngay gio mo: cong 2 phut de sau khi cat toi phut van con sau luc nay it nhat 1 phut.
    setMinMo(localInputValue(new Date(Date.now() + 2 * 60_000)));
    setReady({ count: r.sheets.length });
    setOpen(true);
    return true;
  }

  function cancel() {
    setOpen(false);
    baoLoi(null);
  }

  /** Xep trang vua chay lai (nguoi viet dang sua trong luc chon niem phong): cap nhat so to se dang. */
  function refresh() {
    if (!open || pending) return;
    const r = prepare();
    setReady("error" in r ? { error: r.error } : { count: r.sheets.length });
  }

  function changeSeal(next: SealDraft) {
    setSeal(next);
    baoLoi(null);
  }

  /** root: khung niem phong, de dua focus toi dong dap an loi dau tien. */
  function publish(root: HTMLElement | null) {
    // Trang vua bi xoa trang trong luc chon niem phong: bao ngay, chua cham toi ban nhap hay tu luu.
    if ("error" in ready) {
      baoLoi(ready.error);
      return;
    }
    // Kiem niem phong TRUOC khi cham toi ban nhap: sai thi khung van mo, beforePublish chua chay nen tu luu
    // khong bi tat va khong co gi can afterFail. May chu kiem lai tu dau trong actionPublish; lop nay chi de
    // bao loi som va ro.
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
      root?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
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
    // Muc gap khong mo thi khong gui gi ve sach (spec). Mo thi kiem tai cho bang dung bo luat cua may chu.
    const doiGi = doiMo && bookNow !== null ? doi.payload() : null;
    if (doiGi !== null) {
      if (!doi.check()) return;
      const daKiem = parseBookEdit(doiGi);
      if ("error" in daKiem) {
        baoLoi(daKiem.error);
        return;
      }
    }
    baoLoi(null);
    startTransition(async () => {
      await beforePublish();
      try {
        // Chay lai prepare() sau beforePublish() (vung soan thao da khoa, nhap da luu), dung ket qua moi nay
        // de dang thay vi so to dang hien: cai duoc dang la dung chu co tren trang luc bam Dang, ke ca chu
        // vua go sau lan xep trang cuoi.
        const fresh = prepare();
        if ("error" in fresh) {
          setError(fresh.error);
          afterFail();
          return;
        }
        const r = await actionPublish(bookId, fresh.sheets, payload.seal, doiGi);
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

  return {
    bookId, mediaEnabled, open, ready, seal, error, invalid, minMo, pending, start, cancel, refresh, changeSeal, publish,
    doi: bookNow === null ? null : doi, doiMo, toggleDoi: () => setDoiMo((x) => !x),
  };
}

export type PublishFlow = ReturnType<typeof usePublish>;

/**
 * Nut Dang trang o thanh tren. Mo khung niem phong, keo dau man viet len dinh cua so de ca ba cot vua mot man,
 * roi dua focus toi loai dang chon. Khung dang mo thi nut an di: nut Dang cua khung thay cho no.
 */
export function PublishButton({ flow, ref }: { flow: PublishFlow; ref?: Ref<HTMLButtonElement> }) {
  if (flow.open) return null;
  return (
    <div className="dang">
      <button
        ref={ref}
        type="button"
        className="btn"
        onClick={() => {
          flushSync(() => {
            flow.start();
          });
        }}
      >
        Đăng trang
      </button>
      {flow.error && <p className="luu luu--loi" role="alert">{flow.error}</p>}
    </div>
  );
}

/**
 * Khung dang trang kem niem phong, gom hai cot: cot trai chon loai niem phong, cau xac nhan va hai nut; cot
 * giua cac o cua loai da chon (khong co khi chon Khong). To giay dang viet la cot thu ba, do Editor ve.
 */
export function PublishPanel({ flow, bookTitle, partnerNickname, onCancel }: {
  flow: PublishFlow;
  bookTitle: string;
  partnerNickname: string | null;
  /** Dong khung. Editor tra focus ve nut Dang trang. */
  onCancel: () => void;
}) {
  const hopRef = useRef<HTMLDivElement>(null);
  const doiId = useId();
  const { seal, ready, error, pending } = flow;
  // O bia dang doc hay dang tai anh len: dang luc nay se ghi lai dung bia CU va bo roi bia vua tai len. Khoa nut Dang
  // cho toi khi xong, dung nhu nut gui cua form sach (BookForm). "De sau" van bam duoc: do la duong rut lui.
  const busy = flow.doi?.busy ?? false;
  const cau = cauXacNhan(seal.kind, partnerNickname);
  const loai = luaChon(partnerNickname).find((c) => c.kind === seal.kind);

  // Vua mo: dua dau man viet len dinh cua so (thanh tren dinh san o do, ba cot vua phan con lai), roi focus
  // loai dang chon de ban phim di tiep tu cot trai.
  useEffect(() => {
    const hop = hopRef.current;
    if (!hop) return;
    hop.closest(".viet")?.scrollIntoView({ block: "start" });
    hop.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus({ preventScroll: true });
  }, []);

  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- khung xac nhan gom nhom loai (fieldset rieng) va cac o cua loai; khong tag ngu nghia nao trong danh sach de xuat khop dung.
    <div ref={hopRef} className={seal.kind === "khong" ? "niem niem--khong" : "niem"} role="group" aria-label="Xác nhận đăng trang">
      <div className="niem__chon">
        <SealKinds
          partnerNickname={partnerNickname}
          value={seal.kind}
          onChange={(kind) => flow.changeSeal({ ...seal, kind })}
          disabled={pending}
        />
        <div className="niem__cuoi">
          {"error" in ready ? (
            <p className="dang-hoi__chu">{ready.error}</p>
          ) : (
            <p className="dang-hoi__chu">
              Đăng <b>{ready.count} trang</b> vào <b>{bookTitle}</b>{cau.giua}.
            </p>
          )}
          {/* Loi chung dat ngay tren hai nut. */}
          {error && <p className="luu luu--loi" role="alert">{error}</p>}
          <div className="dang-hoi__nut">
            <button type="button" className="btn" disabled={pending || busy} onClick={() => flow.publish(hopRef.current)}>Đăng</button>
            <button type="button" className="btn btn--line" disabled={pending} onClick={onCancel}>Để sau</button>
          </div>
          {flow.doi !== null && (
            <div className="doi-sach">
              <button
                type="button"
                className="btn btn--chu doi-sach__mo"
                aria-expanded={flow.doiMo}
                aria-controls={doiId}
                disabled={pending}
                onClick={flow.toggleDoi}
              >
                Đổi bìa, tên, nhạc
              </button>
              {flow.doiMo && (
                <div className="doi-sach__o" id={doiId}>
                  <BookEditFields state={flow.doi} bookId={flow.bookId} mediaEnabled={flow.mediaEnabled} disabled={pending} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {seal.kind !== "khong" && (
        <div className="niem__form" key={seal.kind}>
          <div className="niem__dau">
            <h2 className="d niem__ten">{loai?.ten}</h2>
            <p className="niem__ghi">{cau.sau}</p>
          </div>
          <SealFields
            value={seal}
            onChange={flow.changeSeal}
            disabled={pending}
            minOpensAt={flow.minMo}
            invalidAnswerIds={flow.invalid}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState, useTransition, type Ref } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { actionPublish } from "@/app/actions/library";
import { CAN_TEN_LUOT } from "@/app/actions/messages";
import { cauOLuot, type TrimInput } from "@/lib/book";
import type { DocJson } from "@/lib/doc/types";
import { parseSealInput } from "@/lib/seal/input";
import { parseTenLuot, TEN_LUOT_TOI_DA } from "@/lib/viet-cung";
import { luaChon, SealFields, SealKinds } from "./SealPicker";
import { blankAnswerIds, emptySeal, localInputValue, sealPayload, type SealChoice, type SealDraft } from "./sealDraft";

export type PublishDeps = {
  bookId: string;
  partnerNickname: string | null;
  /** Do va xep trang lan cuoi, cat tai lieu thanh cac to (da bo to trong o cuoi). */
  prepare: () => { sheets: DocJson[] } | { error: string };
  /** Khoa vung soan thao, luu nhap lan cuoi va tat hen gio tu luu. */
  beforePublish: () => Promise<void>;
  /** Dang hong thi mo lai vung soan thao va cho tu luu chay lai. */
  afterFail: () => void;
  /** Sach viet cung (5c muc H2): khong niem phong, ten luot bat buoc. */
  vietCung?: boolean;
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
export function usePublish({ bookId, partnerNickname, prepare, beforePublish, afterFail, vietCung = false }: PublishDeps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<SanSang>({ count: 0 });
  const [seal, setSeal] = useState<SealDraft>(emptySeal);
  // O ten luot cua sach viet cung va co bao thieu ten (hien duoi o, focus ve o).
  const [tenLuot, setTenLuot] = useState("");
  const [tenLoi, setTenLoi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<ReadonlySet<number>>(KHONG_LOI);
  const [minMo, setMinMo] = useState("");
  const [pending, startTransition] = useTransition();

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

  function changeTen(next: string) {
    setTenLuot(next);
    setTenLoi(false);
  }

  /**
   * Buoc gui chung cua ca hai loai sach: khoa vung soan thao va luu nhap lan cuoi, cat lai cac to tu chu dang co, roi goi
   * actionPublish. Dang thanh cong thi action chuyen trang; hong thi mo lai vung soan thao.
   */
  function gui(sealGui: unknown, ten: string | null) {
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
        const r = await actionPublish(bookId, fresh.sheets, sealGui, ten);
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

  /** root: khung niem phong, de dua focus toi dong dap an loi dau tien. */
  function publish(root: HTMLElement | null) {
    // Trang vua bi xoa trang trong luc chon niem phong: bao ngay, chua cham toi ban nhap hay tu luu.
    if ("error" in ready) {
      baoLoi(ready.error);
      return;
    }
    // Sach viet cung: khong niem phong; ten luot bat buoc, kiem som bang dung parseTenLuot cua may chu (5c muc H2).
    if (vietCung) {
      const ten = parseTenLuot(tenLuot);
      if (ten === null) {
        flushSync(() => {
          setError(null);
          setTenLoi(true);
        });
        root?.querySelector<HTMLInputElement>(".ten-luot input")?.focus();
        return;
      }
      baoLoi(null);
      gui(null, ten);
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
    baoLoi(null);
    gui(payload.seal, null);
  }

  return {
    open, ready, seal, error, invalid, minMo, pending, start, cancel, refresh, changeSeal, publish,
    vietCung, tenLuot, tenLoi, changeTen,
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
/**
 * O "Tên lượt" thay cho cot chon niem phong o sach viet cung (5c muc H2): bat buoc, toi da TEN_LUOT_TOI_DA ky tu, doi lai
 * duoc khi sua luot. Enter trong o la bam Dang. Thieu ten thi cau nhac hien duoi o va focus ve o (usePublish lo).
 */
function TenLuot({ flow, onDang }: { flow: PublishFlow; onDang: () => void }) {
  const id = useId();
  return (
    <div className="ten-luot">
      <label className="ten-luot__t" htmlFor={id}>Tên lượt</label>
      <p className="ten-luot__ghi" id={`${id}-ghi`}>Mỗi lượt trong sách viết cùng có tên riêng, như một chương. Đổi lại được khi sửa lượt.</p>
      <input
        className="input"
        id={id}
        type="text"
        value={flow.tenLuot}
        maxLength={TEN_LUOT_TOI_DA}
        placeholder="Tên chương này"
        autoComplete="off"
        aria-invalid={flow.tenLoi}
        aria-describedby={flow.tenLoi ? `${id}-ghi ${id}-loi` : `${id}-ghi`}
        disabled={flow.pending}
        onChange={(e) => flow.changeTen(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onDang();
        }}
      />
      {flow.tenLoi && <p className="form__loi" id={`${id}-loi`} role="alert">{CAN_TEN_LUOT}</p>}
    </div>
  );
}

export function PublishPanel({ flow, bookId, bookTitle, partnerNickname, oLuot, onCancel }: {
  flow: PublishFlow;
  bookId: string;
  bookTitle: string;
  partnerNickname: string | null;
  /** Hai o ma ban nhap dang giu cho luot nay. Buoc dang chi BAO LAI, khong sua duoc o day. */
  oLuot: TrimInput;
  /** Dong khung. Editor tra focus ve nut Dang trang. */
  onCancel: () => void;
}) {
  const hopRef = useRef<HTMLDivElement>(null);
  const { seal, ready, error, pending, vietCung } = flow;
  // Sach viet cung khong co niem phong: cau xac nhan nhu "Không".
  const cau = cauXacNhan(vietCung ? "khong" : seal.kind, partnerNickname);
  const loai = luaChon(partnerNickname).find((c) => c.kind === seal.kind);

  // Vua mo: dua dau man viet len dinh cua so (thanh tren dinh san o do, ba cot vua phan con lai), roi focus
  // loai dang chon (hay o ten luot o sach viet cung) de ban phim di tiep tu cot trai.
  useEffect(() => {
    const hop = hopRef.current;
    if (!hop) return;
    hop.closest(".viet")?.scrollIntoView({ block: "start" });
    hop.querySelector<HTMLInputElement>('input[type="radio"]:checked, .ten-luot input')?.focus({ preventScroll: true });
  }, []);

  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- khung xac nhan gom nhom loai (fieldset rieng) va cac o cua loai; khong tag ngu nghia nao trong danh sach de xuat khop dung.
    <div ref={hopRef} className={vietCung || seal.kind === "khong" ? "niem niem--khong" : "niem"} role="group" aria-label="Xác nhận đăng trang">
      <div className="niem__chon">
        {vietCung ? (
          <TenLuot flow={flow} onDang={() => flow.publish(hopRef.current)} />
        ) : (
          <SealKinds
            partnerNickname={partnerNickname}
            value={seal.kind}
            onChange={(kind) => flow.changeSeal({ ...seal, kind })}
            disabled={pending}
          />
        )}
        <div className="niem__cuoi">
          {"error" in ready ? (
            <p className="dang-hoi__chu">{ready.error}</p>
          ) : (
            <p className="dang-hoi__chu">
              Đăng <b>{ready.count} trang</b> vào <b>{bookTitle}</b>{cau.giua}.
            </p>
          )}
          {/*
            Mot dong chu tinh thay cho muc gap "Doi bia, ten, nhac" da bo: buoc dang chi bao lai luot nay them gi, con
            doi thi o trang Viet tiep. Khong o nhap nao o day, nen buoc dang khong dai them va khong co gi phai cho tai.
          */}
          <p className="dang-hoi__o">
            {cauOLuot(oLuot)}{" "}
            <Link className="btn btn--chu" href={`/sach/${bookId}/viet-tiep`}>Đổi ở trang Viết tiếp</Link>
          </p>
          {/* Loi chung dat ngay tren hai nut. */}
          {error && <p className="luu luu--loi" role="alert">{error}</p>}
          <div className="dang-hoi__nut">
            <button type="button" className="btn" disabled={pending} onClick={() => flow.publish(hopRef.current)}>Đăng</button>
            <button type="button" className="btn btn--line" disabled={pending} onClick={onCancel}>Để sau</button>
          </div>
        </div>
      </div>
      {!vietCung && seal.kind !== "khong" && (
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

"use client";

import { useId, useRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { SEAL_LIMITS } from "@/lib/seal/types";
import { entryRow, type EntryRow, type SealChoice, type SealDraft } from "./sealDraft";

type Props = {
  /** Biet danh nguoi kia khi sach chia se, null khi rieng tu: rieng tu chi con Khong va Hen gio. */
  partnerNickname: string | null;
  value: SealDraft;
  onChange: (next: SealDraft) => void;
  disabled: boolean;
  /** min cua o datetime-local (gio dia phuong), PublishBar tinh mot lan luc mo hop. Chi goi y cho bo chon ngay, may chu van quyet. */
  minOpensAt: string;
  /** id cac dong dap an bi danh dau loi sau lan bam Dang hong (blankAnswerIds). Rong thi khong dong nao loi. */
  invalidAnswerIds: ReadonlySet<number>;
};

const DAU_XOA: ReactNode = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DAP_AN_RONG = "Đáp án cần có chữ, chỉ dấu câu thì không ai đoán được.";
const KHONG_LOI: ReadonlySet<number> = new Set();

function luaChon(partnerNickname: string | null): { kind: SealChoice; ten: string; ghi: string }[] {
  const khong = { kind: "khong" as const, ten: "Không", ghi: partnerNickname ? `${partnerNickname} đọc được ngay.` : "Đăng như thường." };
  const henGio = { kind: "hen-gio" as const, ten: "Hẹn giờ", ghi: "Tự mở vào một ngày." };
  if (partnerNickname === null) return [khong, henGio];
  return [
    khong,
    { kind: "cau-do", ten: "Câu đố", ghi: "Trả lời đúng mới đọc." },
    henGio,
    { kind: "trao-doi", ten: "Trao đổi", ghi: "Viết một trang để đọc." },
  ];
}

type EntryListProps = {
  label: string;
  noun: string;
  rows: EntryRow[];
  min: number;
  max: number;
  maxLength: number;
  help: string;
  addLabel: string;
  disabled: boolean;
  /** id cac dong bi danh dau loi. */
  invalidIds: ReadonlySet<number>;
  /** Cau hien thay dong ghi chu khi co dong loi. */
  invalidHelp: string;
  onRows: (rows: EntryRow[]) => void;
};

/**
 * Danh sach o nhap them va xoa duoc. Xoa khi da cham so dong toi thieu thi chi xoa chu cua dong do. Focus
 * nhu sau: Them focus o moi; Xoa focus dong ke sau (khong co thi dong truoc), het dong
 * thi focus nut Them; dong toi thieu thi o lai chinh o do.
 */
function EntryList({ label, noun, rows, min, max, maxLength, help, addLabel, disabled, invalidIds, invalidHelp, onRows }: EntryListProps) {
  const id = useId();
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const themRef = useRef<HTMLButtonElement>(null);
  const coLoi = rows.some((r) => invalidIds.has(r.id));

  // Doi focus ngay trong trinh xu ly su kien: flushSync ve xong danh sach moi (ref callback da chay, nut Them
  // da het disabled) roi moi focus. Khong can effect, state focusId hay dong tat react/set-state-in-effect.
  function them() {
    const r = entryRow();
    flushSync(() => onRows([...rows, r]));
    inputs.current.get(r.id)?.focus();
  }

  function xoa(rowId: number) {
    if (rows.length <= min) {
      flushSync(() => onRows(rows.map((r) => (r.id === rowId ? { ...r, text: "" } : r))));
      inputs.current.get(rowId)?.focus();
      return;
    }
    const i = rows.findIndex((r) => r.id === rowId);
    const ke: EntryRow | undefined = rows[i + 1] ?? rows[i - 1];
    flushSync(() => onRows(rows.filter((r) => r.id !== rowId)));
    if (ke) inputs.current.get(ke.id)?.focus();
    else themRef.current?.focus();
  }

  return (
    <div className="field">
      <p className="field__label" id={`${id}-nhan`}>{label}</p>
      {rows.length > 0 && (
        <ul className="ds-nhap" aria-labelledby={`${id}-nhan`}>
          {rows.map((r, i) => {
            const sai = invalidIds.has(r.id);
            return (
              <li key={r.id} className="dong-nhap">
                <div className="field__o">
                  <input
                    ref={(el) => {
                      if (el) inputs.current.set(r.id, el);
                      else inputs.current.delete(r.id);
                    }}
                    className="input"
                    type="text"
                    maxLength={maxLength}
                    value={r.text}
                    aria-label={`${noun} ${i + 1}`}
                    aria-invalid={sai}
                    aria-describedby={`${id}-ghi`}
                    disabled={disabled}
                    onChange={(e) => onRows(rows.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))}
                  />
                  {sai && <span className="field__dau dau-loi" aria-hidden="true">!</span>}
                </div>
                <button
                  type="button"
                  className="btn btn--quiet btn--icon"
                  aria-label={`Xóa ${noun.toLocaleLowerCase("vi")} ${i + 1}`}
                  disabled={disabled}
                  onClick={() => xoa(r.id)}
                >
                  {DAU_XOA}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className={coLoi ? "field__help field__help--loi" : "field__help"} id={`${id}-ghi`}>
        {coLoi ? invalidHelp : help}
      </p>
      <button
        ref={themRef}
        type="button"
        className="btn btn--line btn--sm them"
        disabled={disabled || rows.length >= max}
        onClick={them}
      >
        {addLabel}
      </button>
    </div>
  );
}

/**
 * Nhom Niem phong trong hop xac nhan dang. Chi soan du lieu; kiem va gui do
 * PublishBar lam. Moi chu hien o day deu la nhan, khong nhac dieu luat nao cua thu thach.
 */
export function SealPicker({ partnerNickname, value, onChange, disabled, minOpensAt, invalidAnswerIds }: Props) {
  const id = useId();
  const set = (patch: Partial<SealDraft>) => onChange({ ...value, ...patch });

  const cauHoi = (
    <div className="field">
      <label className="field__label" htmlFor={`${id}-hoi`}>Câu hỏi</label>
      <input
        id={`${id}-hoi`}
        className="input"
        type="text"
        maxLength={SEAL_LIMITS.questionMax}
        value={value.question}
        disabled={disabled}
        aria-describedby={value.kind === "trao-doi" ? `${id}-hoi-ghi` : undefined}
        onChange={(e) => set({ question: e.target.value })}
      />
      {value.kind === "trao-doi" && (
        <p className="field__help" id={`${id}-hoi-ghi`}>Người kia viết một trang trả lời thì cả hai trang cùng mở.</p>
      )}
    </div>
  );

  return (
    <>
      <fieldset className="chon chon-niem" disabled={disabled}>
        <legend>Niêm phong</legend>
        <div className="chon__ds">
          {luaChon(partnerNickname).map((c) => (
            <label key={c.kind} className="the-chon">
              <input type="radio" name={`${id}-loai`} value={c.kind} checked={value.kind === c.kind} onChange={() => set({ kind: c.kind })} />
              <span className="the-chon__t">{c.ten}</span>
              <span className="the-chon__x">{c.ghi}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {value.kind === "cau-do" && (
        <div className="niem-o">
          {cauHoi}
          <EntryList
            label="Đáp án đúng"
            noun="Đáp án"
            rows={value.answers}
            min={1}
            max={SEAL_LIMITS.answersMax}
            maxLength={SEAL_LIMITS.answerMax}
            help="Không phân biệt dấu, hoa thường, dấu câu"
            addLabel="Thêm đáp án"
            disabled={disabled}
            invalidIds={invalidAnswerIds}
            invalidHelp={DAP_AN_RONG}
            onRows={(answers) => set({ answers })}
          />
          <EntryList
            label="Gợi ý"
            noun="Gợi ý"
            rows={value.hints}
            min={0}
            max={SEAL_LIMITS.hintsMax}
            maxLength={SEAL_LIMITS.hintMax}
            help="Gợi ý mở dần khi trả lời sai"
            addLabel="Thêm gợi ý"
            disabled={disabled}
            invalidIds={KHONG_LOI}
            invalidHelp=""
            onRows={(hints) => set({ hints })}
          />
        </div>
      )}

      {value.kind === "hen-gio" && (
        <div className="niem-o">
          <div className="field">
            <label className="field__label" htmlFor={`${id}-gio`}>Ngày giờ mở</label>
            <input
              id={`${id}-gio`}
              className="input"
              type="datetime-local"
              min={minOpensAt}
              value={value.opensAt}
              disabled={disabled}
              aria-describedby={`${id}-gio-ghi`}
              onChange={(e) => set({ opensAt: e.target.value })}
            />
            <p className="field__help" id={`${id}-gio-ghi`}>Chính bạn cũng không mở sớm được.</p>
          </div>
        </div>
      )}

      {value.kind === "trao-doi" && <div className="niem-o">{cauHoi}</div>}
    </>
  );
}

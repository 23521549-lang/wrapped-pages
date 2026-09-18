export type SaveStatus =
  | { kind: "da-luu"; at: string }
  | { kind: "chua-luu" }
  | { kind: "dang-luu" }
  /** message la chu that su nguoi dung se thay (SaveBadge), vd ly do rieng khi vuot tran do dai. */
  | { kind: "loi"; message: string };

export type SaveResult = { savedAt: string } | { error: string };

/** Nhap tu luu sau 3 giay ngung go. */
export const AUTOSAVE_MS = 3000;

type Options<S> = {
  save: (snapshot: S) => Promise<SaveResult>;
  /** Chup trang thai hien tai de luu; null khi chua co gi de chup. */
  take: () => S | null;
  onStatus: (status: SaveStatus) => void;
  delayMs?: number;
};

/**
 * Bo tu luu, khong phu thuoc React de kiem thu duoc bang dong ho gia. Moi lan tai lieu doi thi goi
 * changed(); bo nay luu mot lan, AUTOSAVE_MS sau lan doi cuoi, va khong bao gio gui hai lan luu cung luc.
 * Trang thai "chua-luu" chi bao mot lan cho moi dot go, de giao dien khong ve lai o moi phim.
 */
export function createAutosave<S>({ save, take, onStatus, delayMs = AUTOSAVE_MS }: Options<S>) {
  let version = 0;
  let saved = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;
  let last: SaveStatus["kind"] | null = null;
  // Cong tac tat (luc dang trang): mot khi bat, changed() khong dat hen gio nua va flush() thanh
  // khong lam gi - dung de chan duong ban nhap song lai qua flush() vo dieu kien trong cleanup luc
  // thoat component sau khi dang THANH CONG (redirect() thao component, resume() khong bao gio duoc
  // goi toi). Chi mo lai duoc bang resume() goi tuong minh - khong tu dong bat lai qua bat ky su kien
  // thu dong nao (vd nguoi dung go tiep), de khong lap lai dung loi goc: dispose() cu tuong da tat
  // nhung changed() tu onUpdate van am tham dat hen gio moi.
  let stopped = false;

  const emit = (status: SaveStatus) => {
    if (status.kind === "chua-luu" && last === "chua-luu") return;
    last = status.kind;
    onStatus(status);
  };

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  async function flush(): Promise<boolean> {
    if (stopped) return true;
    clear();
    if (inFlight) await inFlight;
    if (version === saved) return true;
    const snapshot = take();
    if (snapshot === null) return false;
    const v = version;
    emit({ kind: "dang-luu" });
    inFlight = save(snapshot)
      .then(
        (r) => {
          if ("error" in r) {
            // Chuyen thang thong diep tu server action ra SaveBadge: tra loi rieng cho vuot
            // tran do dai roi bo mac cho no bi dut o day thi coi nhu chua sua gi ca tu phia nguoi dung.
            emit({ kind: "loi", message: r.error });
            return false;
          }
          saved = Math.max(saved, v);
          emit(version === v ? { kind: "da-luu", at: r.savedAt } : { kind: "chua-luu" });
          return true;
        },
        () => {
          emit({ kind: "loi", message: "Mất kết nối lúc lưu. Kiểm tra mạng rồi thử lại." });
          return false;
        },
      )
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    changed() {
      version += 1;
      emit({ kind: "chua-luu" });
      clear();
      // Da tat vinh vien thi khong dat hen gio nua: khong co lan luu tu dong nao den sau khi dang.
      // isDirty() van phan anh dung la co thay doi chua luu, de canh bao roi trang (beforeunload)
      // van dung neu nguoi dung go tiep sau mot lan dang hong.
      if (stopped) return;
      timer = setTimeout(() => void flush(), delayMs);
    },
    flush,
    isDirty: () => version !== saved,
    dispose: clear,
    /** Tat bo tu luu: chi het tac dung khi resume() duoc goi tuong minh. Goi sau lan luu cuoi cung truoc khi dang. */
    stop() {
      stopped = true;
      clear();
    },
    /** Mo lai bo tu luu sau stop(). Goi khi dang hong va nguoi dung con o lai trang, con go tiep. */
    resume() {
      stopped = false;
    },
  };
}

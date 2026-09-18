import { AUDIO_MAX_MS } from "@/lib/media/kinds";
import { levelOf, peaksFromLevels } from "@/lib/media/peaks";

/** Nhip do muc am va dong ho ghi. */
export const RECORDING_TICK_MS = 100;

/**
 * Vi sao ban ghi ket thuc: nguoi dung bam Dung, cham tran AUDIO_MAX_MS, hay trinh duyet tu ngat giua chung (rut micro,
 * mat quyen, cuoc goi den, he dieu hanh doi lai thiet bi).
 */
export type StopCause = "nguoi-dung" | "het-gio" | "ngat";

export type Recording = { blob: Blob; ms: number; peaks: number[]; cause: StopCause };

export type RecordingSession = {
  /** Dung va giu ban ghi: onDone nhan ban ghi. */
  stop: () => void;
  /** Bo ban ghi: tat micro, khong goi onDone. */
  cancel: () => void;
};

type Handlers = {
  /** Moi RECORDING_TICK_MS: thoi gian da ghi va moi muc am da do tu dau (0 toi 1). */
  onTick: (ms: number, levels: readonly number[]) => void;
  onDone: (recording: Recording) => void;
  /** Trinh duyet ngat giua chung ma khong giu duoc byte nao: khong co gi de nghe thu, noi goi phai bao loi. */
  onLost: () => void;
};

/**
 * Ghi am tu mot stream micro da duoc cho phep, khong phu thuoc React. MediaRecorder ghi theo mime da chon;
 * AnalyserNode do muc am moi RECORDING_TICK_MS de ve thanh muc am va tinh song am PEAK_COUNT cot khi dung. Toi AUDIO_MAX_MS
 * thi tu dung (cause "het-gio").
 *
 * Dung, huy, hay chinh MediaRecorder tu ngung (mat micro, mat quyen giua chung, trinh duyet tu dung) deu phai xoa dong ho
 * ngay va tat het track cua micro dung mot lan (co flag xong): khong duong nao duoc phep de sot mot khoang setInterval
 * chay ngam hay mot track con mo. Tat track va dong AudioContext doi den onstop moi chay, khong phai ngay sau
 * recorder.stop(), vi trinh duyet flush du lieu cuoi cung khong dong bo: tat nguon truoc co the cat mat duoi doan ghi.
 *
 * Trinh duyet tu ngat (rut micro, mat quyen giua chung, cuoc goi den) thi dac ta cho ban dataavailable cuoi roi ban stop,
 * nen cac chunk da ghi thuong van phat duoc. Mat tieng nguoi dung da ghi la loi nang, nen duong nay KHONG duoc im
 * lang: con byte thi noi goi nhan ban ghi voi cause "ngat" de nguoi dung nghe thu va chen; khong con byte nao thi goi
 * onLost de noi goi bao loi. Moi duong ket thuc deu di qua bao(), nen ms luon la so nguyen tu 1 toi AUDIO_MAX_MS va
 * onDone/onLost chi chay dung mot lan.
 *
 * Khoi tao (MediaRecorder, AudioContext, cac buoc noi day, recorder.start()) nem loi thi don sach phan da tao roi nem
 * tiep, de noi goi (RecorderBox, cung boc trong try cua rieng no) khong phai lo don rac khi ham nay nem.
 */
export function startRecording(stream: MediaStream, mime: string, { onTick, onDone, onLost }: Handlers): RecordingSession {
  let context: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  try {
    const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 });
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const mau = new Uint8Array(analyser.fftSize);
    const batDau = Date.now();
    const levels: number[] = [];
    const chunks: Blob[] = [];
    let ms = 0;
    /** Nguoi dung da yeu cau gi: "chua" nghia la moi ket thuc den tu trinh duyet chu khong phai tu nut nao. */
    let yeuCau: "chua" | "giu" | "bo" = "chua";
    let tuDung = false;
    let xong = false;
    let daBao = false;

    /** Giai phong tai nguyen dung mot lan: tat moi track cua micro va dong AudioContext. An toan goi lai nhieu lan. */
    function don() {
      if (xong) return;
      xong = true;
      if (timer !== null) clearInterval(timer);
      for (const track of stream.getTracks()) track.stop();
      context?.close().catch(() => {});
    }

    /**
     * Bao ket qua dung mot lan. Chot thoi gian ngay tai day cho MOI duong ket thuc: it nhat 1 ms (dung ngay lap tuc van
     * la mot doan ghi that), nhieu nhat AUDIO_MAX_MS. Khong con chunk nao thi khong co gi de nghe thu: onLost.
     */
    function bao(cause: StopCause) {
      if (daBao) return;
      daBao = true;
      ms = Math.min(AUDIO_MAX_MS, Math.max(1, ms, Date.now() - batDau));
      if (chunks.length === 0) onLost();
      else onDone({ blob: new Blob(chunks, { type: recorder.mimeType || mime }), ms, peaks: peaksFromLevels(levels), cause });
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      don();
      // Huy la duong duy nhat khong bao gi. Con lai: nguoi dung bam Dung, tu dung o tran, hay trinh duyet tu ngat
      // (yeuCau con "chua") - deu phai den duoc nguoi dung.
      if (yeuCau === "bo") return;
      bao(yeuCau === "chua" ? "ngat" : tuDung ? "het-gio" : "nguoi-dung");
    };
    // Dac ta: sau error, trinh duyet dat state ve inactive, ban dataavailable cuoi roi ban stop. Khong cho stop o day vi
    // khong phai trinh duyet nao cung ban du ba su kien; daBao chan lan bao thu hai neu stop van toi sau. Dung
    // addEventListener chu khong gan onerror: mot so trinh duyet coi onerror cua doi tuong la cho rieng cua chung.
    recorder.addEventListener("error", () => {
      don();
      if (yeuCau === "bo") return;
      bao("ngat");
    });

    function ket(giuBan: boolean, tu: boolean) {
      yeuCau = giuBan ? "giu" : "bo";
      tuDung = tu;
      // Dong ho phai het luon o day: khong de no phu thuoc vao onstop co chay hay khong.
      if (timer !== null) clearInterval(timer);
      // Chi buoc goi recorder.stop() phu thuoc trang thai. Recorder co the da tu ngung (mat micro, mat quyen) truoc khi
      // ta goi ket: luc do khong con su kien stop nao de cho, nen don() va bao() phai chay thang o day thay vi cho
      // onstop - neu khong, nut Dung se la mot nut khong lam gi va khong noi gi.
      if (recorder.state !== "inactive") {
        recorder.stop();
        return;
      }
      don();
      if (giuBan) bao("ngat");
    }

    timer = setInterval(() => {
      analyser.getByteTimeDomainData(mau);
      levels.push(levelOf(mau));
      ms = Math.min(AUDIO_MAX_MS, Date.now() - batDau);
      onTick(ms, levels);
      if (ms >= AUDIO_MAX_MS) ket(true, true);
    }, RECORDING_TICK_MS);
    recorder.start();

    return { stop: () => ket(true, false), cancel: () => ket(false, false) };
  } catch (err) {
    if (timer !== null) clearInterval(timer);
    context?.close().catch(() => {});
    throw err;
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUTOSAVE_MS, createAutosave, type SaveResult, type SaveStatus } from "@/components/editor/autosave";

const ok = () => vi.fn(async (_n: number): Promise<SaveResult> => ({ savedAt: "2026-09-11T14:04:00.000Z" }));

function dung(save: (n: number) => Promise<SaveResult>) {
  let n = 0;
  const statuses: SaveStatus["kind"][] = [];
  const a = createAutosave<number>({ save, take: () => n, onStatus: (s) => statuses.push(s.kind) });
  return { a, statuses, set: (v: number) => { n = v; } };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("tu luu ban nhap", () => {
  it("chi luu mot lan, dung 3 giay sau lan go cuoi, voi noi dung moi nhat", async () => {
    const save = ok();
    const { a, set } = dung(save);
    set(1);
    a.changed();
    await vi.advanceTimersByTimeAsync(2000);
    set(2);
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(2);
    expect(a.isDirty()).toBe(false);
  });

  it("bao chua luu, dang luu, da luu, va khong bao lai chua luu o moi phim", async () => {
    const { a, statuses } = dung(ok());
    a.changed();
    a.changed();
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(statuses).toEqual(["chua-luu", "dang-luu", "da-luu"]);
  });

  it("go tiep trong luc dang luu thi van con ban chua luu, va luu tiep 3 giay sau", async () => {
    let xong: (r: SaveResult) => void = () => {};
    const save = vi.fn((_n: number) => new Promise<SaveResult>((r) => { xong = r; }));
    const { a, statuses, set } = dung(save);
    set(1);
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    set(2);
    a.changed();
    xong({ savedAt: "2026-09-11T14:04:00.000Z" });
    await vi.advanceTimersByTimeAsync(0);
    expect(a.isDirty()).toBe(true);
    expect(statuses.at(-1)).toBe("chua-luu");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(2);
  });

  it("luu hong thi bao loi va van con ban chua luu; lan go sau thu lai", async () => {
    const save = vi.fn(async (_n: number): Promise<SaveResult> => ({ error: "khong duoc" }));
    const { a, statuses } = dung(save);
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(statuses.at(-1)).toBe("loi");
    expect(a.isDirty()).toBe(true);
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("mat mang, tuc save nem loi, cung bao loi", async () => {
    const { a, statuses } = dung(vi.fn(async (_n: number): Promise<SaveResult> => { throw new Error("mang"); }));
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(statuses.at(-1)).toBe("loi");
  });

  it("flush luu ngay va huy hen gio; khong co gi moi thi khong goi save", async () => {
    const save = ok();
    const { a } = dung(save);
    expect(await a.flush()).toBe(true);
    expect(save).not.toHaveBeenCalled();
    a.changed();
    expect(await a.flush()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("dispose huy hen gio dang cho", async () => {
    const save = ok();
    const { a } = dung(save);
    a.changed();
    a.dispose();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  /*
   * Cong tac tat vinh vien sau khi dang trang. Khac voi dispose() (chi huy mot lan hen
   * gio dang cho), stop() phai lam changed() va flush() het tac dung MAI MAI, ke ca goi lai nhieu
   * lan sau do - vi cleanup luc thoat component (redirect sau khi dang) se goi flush() them mot
   * lan nua, va do la duong ma ban nhap song lai neu bo tu luu chua thuc su tat.
   */
  it("stop(): changed() khong bao gio dat hen gio nua, flush() khong lam gi va tra ket qua trung tinh", async () => {
    const save = ok();
    const { a, set } = dung(save);
    set(1);
    a.stop();
    a.changed();
    // Chay het rat nhieu vong AUTOSAVE_MS: khong co hen gio nao duoc dat nen khong co lan luu nao.
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 5);
    expect(save).not.toHaveBeenCalled();
    // flush() cung khong lam gi: khong goi save, chi tra ve mot ket qua trung tinh (khong loi).
    expect(await a.flush()).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("stop(): isDirty() van bao dung co thay doi chua luu, de beforeunload con canh bao duoc", async () => {
    const { a } = dung(ok());
    a.stop();
    expect(a.isDirty()).toBe(false);
    // Neu dang hong va nguoi dung go tiep (afterFail mo khoa lai vung soan thao), changed() van
    // duoc goi tu onUpdate; du autosave da tat, phai bao dung la con thay doi chua luu.
    a.changed();
    expect(a.isDirty()).toBe(true);
    // flush() sau khi tat khong lam gi nen khong bao gio xoa duoc co dirty nay - dung y, vi day la
    // luc bo tu luu da vinh vien ngung ghi len database.
    await a.flush();
    expect(a.isDirty()).toBe(true);
  });

  it("kich ban dang trang: luu lan cuoi, stop, go them mot phim, roi flush lai nhu cleanup luc thoat - khong ghi de lan nua", async () => {
    const save = ok();
    const { a, set } = dung(save);
    set(1);
    a.changed();
    expect(await a.flush()).toBe(true); // luu lan cuoi, giong beforePublish truoc khi goi actionPublish
    expect(save).toHaveBeenCalledTimes(1);

    a.stop(); // cong tac tat vinh vien, ngay sau lan luu cuoi cung

    // Gia du nguoi dung go them mot phim trong luc server action dang chay: onUpdate van goi changed().
    set(2);
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 2);
    expect(save).toHaveBeenCalledTimes(1); // khong co lan tu luu nao moi

    // Cleanup luc component thoat (do redirect sau khi dang) goi flush() mot lan nua: phai la vo hai.
    await a.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalledWith(2);
  });

  /*
   * stop() KHONG duoc vinh vien mot chieu. Dang THAT BAI thi nguoi dung con o lai trang
   * va go tiep - luc do tu luu phai chay lai that su, khong chi bao "chua luu" suong roi bo mac cho
   * den khi tai lai trang. resume() la loi goi tuong minh duy nhat dua stopped ve false; khong su
   * kien thu dong nao (vd changed() tu onUpdate) tu no bat lai duoc, nen khong lap lai loi goc.
   */
  it("resume() sau stop(): changed() dat hen gio tro lai, het gio ao thi ham luu duoc goi nhu binh thuong", async () => {
    const save = ok();
    const { a, set } = dung(save);
    set(1);
    a.stop();
    a.resume();
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(1);
  });

  it("resume() sau stop(): flush() cung goi ham luu tro lai, khong con la khong lam gi", async () => {
    const save = ok();
    const { a, set } = dung(save);
    set(1);
    a.stop();
    a.resume();
    a.changed();
    expect(await a.flush()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(1);
  });

  it("kich ban dang hong: stop() luc bat dau gui, resume() trong afterFail, go tiep van tu luu binh thuong", async () => {
    const save = ok();
    const { a, set } = dung(save);
    set(1);
    a.changed();
    expect(await a.flush()).toBe(true); // luu lan cuoi, giong beforePublish truoc khi goi actionPublish
    expect(save).toHaveBeenCalledTimes(1);

    a.stop(); // khoa lai ngay khi bat dau gui

    // actionPublish tra loi (dang hong): afterFail resume() roi changed(), dung nhu Editor.tsx lam.
    a.resume();
    a.changed();
    set(2);
    a.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(2);
  });
});

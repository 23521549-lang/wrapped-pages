// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublishButton, PublishPanel, usePublish, type PublishDeps } from "@/components/editor/PublishBar";
import type { DocJson } from "@/lib/doc/types";

/*
 * Buoc dang trang kem niem phong (usePublish, PublishButton, PublishPanel) tren DOM that. Giu dung thu tu:
 * kiem niem phong TRUOC beforePublish, nen niem phong sai khong bao gio tat tu luu; may chu hong thi afterFail.
 */

const { actionPublish } = vi.hoisted(() => ({
  actionPublish: vi.fn(async (..._args: unknown[]) => ({ error: "Chưa đăng được." })),
}));
vi.mock("@/app/actions/library", () => ({ actionPublish }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const SHEET: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Mot" }] }] };

/** Ghep nut va khung nhu Editor: nut an khi khung mo, De sau dong khung. */
function Khung(p: PublishDeps & { onCancel: () => void }) {
  const flow = usePublish(p);
  return (
    <>
      <PublishButton flow={flow} />
      {/* Thay cho lan xep trang cua Editor (usePagedLayout goi refresh sau moi lan do). */}
      <button type="button" onClick={flow.refresh}>Xếp lại</button>
      {flow.open && <PublishPanel flow={flow} bookTitle="Chuyện chưa kể" partnerNickname={p.partnerNickname} onCancel={() => {
        p.onCancel();
        flow.cancel();
      }} />}
    </>
  );
}

/** Ve nut va khung voi cac ham gia, bam Dang trang de mo khung niem phong. */
function moHop(partnerNickname: string | null) {
  const p = {
    prepare: vi.fn((): { sheets: DocJson[] } | { error: string } => ({ sheets: [SHEET] })),
    onCancel: vi.fn(),
    beforePublish: vi.fn(async () => {}),
    afterFail: vi.fn(),
  };
  render(<Khung bookId="b" partnerNickname={partnerNickname} bookNow={null} mediaEnabled={false} {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng trang" }));
  return p;
}

const cauXacNhan = () => document.querySelector(".dang-hoi__chu")?.textContent;
const o = (ten: string) => screen.getByLabelText(ten) as HTMLInputElement;

afterEach(() => {
  cleanup();
  actionPublish.mockClear();
  vi.useRealTimers();
});

describe("PublishBar kem niem phong", () => {
  it("niem phong sai thi bao trong hop, khong goi beforePublish hay action; doi loai va De sau deu xoa loi", () => {
    const p = moHop("Linh");
    expect(p.prepare).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("radio", { name: /Hẹn giờ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(screen.getByRole("alert").textContent).toBe("Chọn ngày giờ mở.");
    expect(screen.getByRole("group", { name: "Xác nhận đăng trang" })).toBeTruthy();
    expect(p.beforePublish).not.toHaveBeenCalled();
    expect(p.afterFail).not.toHaveBeenCalled();
    expect(actionPublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Câu đố/ }));
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Hẹn giờ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("group", { name: "Xác nhận đăng trang" })).toBeNull();
    expect(screen.getByRole("button", { name: "Đăng trang" })).toBeTruthy();
  });

  it("sach rieng tu chi co Khong va Hen gio, cau xac nhan khong chen biet danh nao", () => {
    moHop(null);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["khong", "hen-gio"]);
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, chỉ mình bạn đọc được.");
    expect(document.querySelector(".niem__form")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Hẹn giờ/ }));
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, hẹn giờ mở.");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Hẹn giờ");
    expect(document.querySelector(".niem__ghi")?.textContent).toBe("Tới giờ đó bạn mới đọc lại được.");
  });

  it("gui niem phong lam tham so thu ba sau beforePublish va prepare lan hai; may chu hong thi afterFail", async () => {
    const p = moHop("Linh");
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, Linh đọc được ngay.");
    fireEvent.click(screen.getByRole("radio", { name: /Trao đổi/ }));
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, mở khi Linh viết trang trả lời.");
    fireEvent.change(o("Câu hỏi"), { target: { value: "Hôm đó em nghĩ gì?" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    await waitFor(() => expect(p.afterFail).toHaveBeenCalledTimes(1));
    expect(actionPublish).toHaveBeenCalledWith("b", [SHEET], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" }, null);
    expect(p.beforePublish).toHaveBeenCalledTimes(1);
    expect(p.beforePublish.mock.invocationCallOrder[0]).toBeLessThan(actionPublish.mock.invocationCallOrder[0]);
    expect(p.prepare).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert").textContent).toBe("Chưa đăng được.");
  });

  it("dap an chi co dau cau thi danh dau dung dong, focus toi dong do, khong goi gi len may chu", () => {
    const p = moHop("Linh");
    fireEvent.click(screen.getByRole("radio", { name: /Câu đố/ }));
    fireEvent.change(o("Câu hỏi"), { target: { value: "Mình gặp nhau ở đâu?" } });
    fireEvent.change(o("Đáp án 1"), { target: { value: "Bến xe" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm đáp án" }));
    expect(document.activeElement).toBe(o("Đáp án 2"));
    fireEvent.change(o("Đáp án 2"), { target: { value: "?!" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));

    expect(o("Đáp án 2").getAttribute("aria-invalid")).toBe("true");
    expect(o("Đáp án 1").getAttribute("aria-invalid")).toBe("false");
    expect(document.activeElement).toBe(o("Đáp án 2"));
    const ghi = document.getElementById(o("Đáp án 2").getAttribute("aria-describedby") ?? "");
    expect(ghi?.textContent).toBe("Đáp án cần có chữ, chỉ dấu câu thì không ai đoán được.");
    expect(ghi?.className).toBe("field__help field__help--loi");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(p.beforePublish).not.toHaveBeenCalled();
    expect(actionPublish).not.toHaveBeenCalled();

    fireEvent.change(o("Đáp án 2"), { target: { value: "Miền Đông" } });
    expect(o("Đáp án 2").getAttribute("aria-invalid")).toBe("false");
    expect(ghi?.textContent).toBe("Không phân biệt dấu, hoa thường, dấu câu");
  });

  it("xoa dong thi focus dong ke sau, khong co thi dong truoc, het dong thi nut Them; dong toi thieu chi xoa chu", () => {
    moHop("Linh");
    fireEvent.click(screen.getByRole("radio", { name: /Câu đố/ }));
    fireEvent.change(o("Đáp án 1"), { target: { value: "Bến xe" } });
    fireEvent.click(screen.getByRole("button", { name: "Xóa đáp án 1" }));
    expect(o("Đáp án 1").value).toBe("");
    expect(document.activeElement).toBe(o("Đáp án 1"));

    const them = screen.getByRole("button", { name: "Thêm đáp án" });
    fireEvent.click(them);
    fireEvent.click(them);
    fireEvent.change(o("Đáp án 3"), { target: { value: "dong ba" } });
    fireEvent.click(screen.getByRole("button", { name: "Xóa đáp án 2" }));
    expect(document.activeElement).toBe(o("Đáp án 2"));
    expect(o("Đáp án 2").value).toBe("dong ba");
    fireEvent.click(screen.getByRole("button", { name: "Xóa đáp án 2" }));
    expect(document.activeElement).toBe(o("Đáp án 1"));

    const themGoiY = screen.getByRole("button", { name: "Thêm gợi ý" });
    fireEvent.click(themGoiY);
    expect(document.activeElement).toBe(o("Gợi ý 1"));
    fireEvent.click(screen.getByRole("button", { name: "Xóa gợi ý 1" }));
    expect(screen.queryByLabelText("Gợi ý 1")).toBeNull();
    expect(document.activeElement).toBe(themGoiY);
  });

  it("o ngay gio mo co min la luc mo hop cong 2 phut, theo gio dia phuong", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 13, 8, 0, 30), toFake: ["Date"] });
    moHop(null);
    fireEvent.click(screen.getByRole("radio", { name: /Hẹn giờ/ }));
    expect(o("Ngày giờ mở").getAttribute("min")).toBe("2026-09-13T08:02");
  });

  it("mo khung thi focus loai dang chon; doi loai thi cot giua doi dung cac o cua loai do", () => {
    moHop("Linh");
    const khong = screen.getByRole("radio", { name: /Không/ }) as HTMLInputElement;
    expect(khong.checked).toBe(true);
    expect(document.activeElement).toBe(khong);
    expect(screen.getByRole("group", { name: "Niêm phong" })).toBeTruthy();
    expect(document.querySelector(".niem__form")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Câu đố/ }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Câu đố");
    expect(o("Câu hỏi")).toBeTruthy();
    expect(o("Đáp án 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm gợi ý" })).toBeTruthy();
    expect(screen.queryByLabelText("Ngày giờ mở")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Hẹn giờ/ }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Hẹn giờ");
    expect(o("Ngày giờ mở").type).toBe("datetime-local");
    expect(screen.queryByLabelText("Câu hỏi")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Trao đổi/ }));
    expect(o("Câu hỏi")).toBeTruthy();
    expect(screen.queryByLabelText("Đáp án 1")).toBeNull();
    expect(screen.queryByLabelText("Ngày giờ mở")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Không/ }));
    expect(document.querySelector(".niem__form")).toBeNull();
    expect(document.querySelector(".niem--khong")).toBeTruthy();
  });

  it("sua trang trong luc khung mo: moi lan xep lai thi so to trong cau xac nhan doi theo; trang trong thi bao, khong dang", async () => {
    const p = moHop("Linh");
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, Linh đọc được ngay.");
    p.prepare.mockImplementation(() => ({ sheets: [SHEET, SHEET, SHEET] }));
    fireEvent.click(screen.getByRole("button", { name: "Xếp lại" }));
    expect(cauXacNhan()).toBe("Đăng 3 trang vào Chuyện chưa kể, Linh đọc được ngay.");

    p.prepare.mockImplementation(() => ({ error: "Trang còn trống, chưa có gì để đăng." }));
    fireEvent.click(screen.getByRole("button", { name: "Xếp lại" }));
    expect(cauXacNhan()).toBe("Trang còn trống, chưa có gì để đăng.");
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(screen.getByRole("alert").textContent).toBe("Trang còn trống, chưa có gì để đăng.");
    expect(p.beforePublish).not.toHaveBeenCalled();

    // Go lai chu: dang ra dung ket qua cua prepare() chay SAU beforePublish, khong phai so dang hien.
    p.prepare.mockImplementation(() => ({ sheets: [SHEET, SHEET] }));
    fireEvent.click(screen.getByRole("button", { name: "Xếp lại" }));
    expect(cauXacNhan()).toBe("Đăng 2 trang vào Chuyện chưa kể, Linh đọc được ngay.");
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    await waitFor(() => expect(p.afterFail).toHaveBeenCalledTimes(1));
    expect(actionPublish).toHaveBeenCalledWith("b", [SHEET, SHEET], null, null);
  });
});

import { describe, it, expect } from "vitest";
import { AUDIO_MIMES } from "@/lib/media/kinds";
import { CANCEL_ASK_MS, MIC_ERRORS, micProblem, NEAR_END_MS, pickRecorderMime, RECORDER_MIMES, recordingStatus } from "@/lib/media/record";

describe("pickRecorderMime", () => {
  it("uu tien WebM Opus, roi MP4; khong ho tro dinh dang nao thi null", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=opus");
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime(() => false)).toBeNull();
  });

  it("moi dinh dang ghi deu la mime may chu nhan", () => {
    for (const m of RECORDER_MIMES) expect(AUDIO_MIMES, m).toContain(m.split(";")[0]);
  });
});

describe("micProblem", () => {
  it("chua cho phep va loi bao mat la mot cau, moi loi khac la khong tim thay micro", () => {
    const loi = (name: string) => new DOMException("micro", name);
    expect(["NotAllowedError", "SecurityError"].map((n) => micProblem(loi(n)))).toEqual(["not-allowed", "not-allowed"]);
    expect(["NotFoundError", "OverconstrainedError", "NotReadableError"].map((n) => micProblem(loi(n))))
      .toEqual(["not-found", "not-found", "not-found"]);
    expect(micProblem(new TypeError("khong co mediaDevices"))).toBe("not-found");
    expect(micProblem(undefined)).toBe("not-found");
    expect(MIC_ERRORS).toEqual({ "not-allowed": "Chưa cho phép dùng micro.", "not-found": "Không tìm thấy micro." });
  });
});

describe("recordingStatus", () => {
  it("dang ghi toi 2:50, tu 2:50 bao con 10 giay; huy tu 5 giay thi hoi lai", () => {
    expect([0, NEAR_END_MS - 1, NEAR_END_MS, 180_000].map(recordingStatus)).toEqual(["Đang ghi", "Đang ghi", "Còn 10 giây", "Còn 10 giây"]);
    expect([NEAR_END_MS, CANCEL_ASK_MS]).toEqual([170_000, 5_000]);
  });
});

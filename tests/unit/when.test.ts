import { describe, it, expect } from "vitest";
import { dateLabel, dayKey, dayLabel, editedLabel, haiChuSo, momentLabel, openLabel, savedLabel, timeAgo, timeLabel } from "@/lib/when";

const luc = (iso: string) => new Date(iso);
const NOW = luc("2026-09-11T14:04:00+07:00");

describe("timeAgo", () => {
  it("duoi mot phut, hoac lech dong ho ra tuong lai, la vua xong", () => {
    expect(timeAgo(luc("2026-09-11T14:03:30+07:00"), NOW)).toBe("vừa xong");
    expect(timeAgo(luc("2026-09-11T14:09:00+07:00"), NOW)).toBe("vừa xong");
  });

  it("duoi mot gio thi dem phut", () => {
    expect(timeAgo(luc("2026-09-11T13:23:00+07:00"), NOW)).toBe("41 phút trước");
  });

  it("cung ngay thi dem gio", () => {
    expect(timeAgo(luc("2026-09-11T08:00:00+07:00"), NOW)).toBe("6 giờ trước");
    expect(timeAgo(luc("2026-09-11T00:10:00+07:00"), NOW)).toBe("13 giờ trước");
  });

  it("ngay theo gio Viet Nam chu khong theo UTC", () => {
    // 18:30 UTC ngay 10 la 01:30 ngay 11 o Viet Nam: cung ngay voi NOW.
    expect(timeAgo(luc("2026-09-10T18:30:00Z"), NOW)).toBe("12 giờ trước");
  });

  it("ngay hom truoc la hom qua, ke ca khi chi cach vai gio", () => {
    expect(timeAgo(luc("2026-09-10T23:59:00+07:00"), NOW)).toBe("hôm qua");
    expect(timeAgo(luc("2026-09-10T08:00:00+07:00"), NOW)).toBe("hôm qua");
  });

  it("qua nua dem ma chua toi mot gio thi van dem phut", () => {
    expect(timeAgo(luc("2026-09-11T23:50:00+07:00"), luc("2026-09-12T00:30:00+07:00"))).toBe("40 phút trước");
  });

  it("xa hon thi ghi ngay thang, khac nam thi them nam", () => {
    expect(timeAgo(luc("2026-09-04T20:00:00+07:00"), NOW)).toBe("04.09");
    expect(timeAgo(luc("2025-09-04T20:00:00+07:00"), NOW)).toBe("04.09.2025");
  });
});

describe("savedLabel", () => {
  const TOI = luc("2026-09-11T21:30:00+07:00");

  it("trong ngay thi ghi gio phut", () => {
    expect(savedLabel(luc("2026-09-11T21:04:00+07:00"), TOI)).toBe("Lưu lúc 21:04");
    expect(savedLabel(luc("2026-09-11T00:15:00+07:00"), TOI)).toBe("Lưu lúc 00:15");
  });

  it("hom qua thi ghi hom qua kem gio", () => {
    expect(savedLabel(luc("2026-09-10T23:12:00+07:00"), TOI)).toBe("Lưu hôm qua, 23:12");
  });

  it("xa hon thi ghi ngay, khac nam thi them nam", () => {
    expect(savedLabel(luc("2026-09-04T09:05:00+07:00"), TOI)).toBe("Lưu ngày 04.09");
    expect(savedLabel(luc("2025-12-31T10:00:00+07:00"), TOI)).toBe("Lưu ngày 31.12.2025");
  });
});

describe("momentLabel", () => {
  it("hom nay, hom qua, ngay trong nam, ngay nam khac, luon kem gio", () => {
    expect(momentLabel(luc("2026-09-11T07:41:00+07:00"), NOW)).toBe("hôm nay, 07:41");
    expect(momentLabel(luc("2026-09-10T21:02:00+07:00"), NOW)).toBe("hôm qua, 21:02");
    expect(momentLabel(luc("2026-09-04T21:02:00+07:00"), NOW)).toBe("04.09, 21:02");
    expect(momentLabel(luc("2025-12-31T21:02:00+07:00"), NOW)).toBe("31.12.2025, 21:02");
  });

  it("tinh ngay theo gio Viet Nam, khong theo UTC", () => {
    expect(momentLabel(luc("2026-09-10T17:30:00Z"), NOW)).toBe("hôm nay, 00:30");
  });
});

describe("timeLabel", () => {
  it("gio phut hai chu so, 24 gio, theo gio Viet Nam", () => {
    expect(timeLabel(luc("2026-09-11T07:05:00+07:00"))).toBe("07:05");
    expect(timeLabel(luc("2026-09-11T23:59:00+07:00"))).toBe("23:59");
    expect(timeLabel(luc("2026-09-10T17:30:00Z"))).toBe("00:30");
  });
});

describe("dayKey", () => {
  it("cung ngay lich Viet Nam thi cung khoa, qua nua dem Viet Nam thi doi khoa", () => {
    expect(dayKey(luc("2026-09-11T00:10:00+07:00"))).toBe("2026-09-11");
    expect(dayKey(luc("2026-09-11T23:59:00+07:00"))).toBe("2026-09-11");
    expect(dayKey(luc("2026-09-10T17:00:00Z"))).toBe("2026-09-11");
    expect(dayKey(luc("2026-09-10T16:59:00Z"))).toBe("2026-09-10");
    expect(dayKey(luc("2025-01-04T09:00:00+07:00"))).toBe("2025-01-04");
  });
});

describe("dayLabel", () => {
  it("Hom nay, Hom qua, ngay thang trong nam, them nam khi khac nam", () => {
    expect(dayLabel(luc("2026-09-11T00:00:00+07:00"), NOW)).toBe("Hôm nay");
    expect(dayLabel(luc("2026-09-10T23:59:00+07:00"), NOW)).toBe("Hôm qua");
    expect(dayLabel(luc("2026-09-10T00:00:00+07:00"), NOW)).toBe("Hôm qua");
    expect(dayLabel(luc("2026-09-04T21:02:00+07:00"), NOW)).toBe("04.09");
    expect(dayLabel(luc("2025-12-31T21:02:00+07:00"), NOW)).toBe("31.12.2025");
  });

  it("tinh ngay theo gio Viet Nam; lech dong ho ra tuong lai van la Hom nay", () => {
    expect(dayLabel(luc("2026-09-10T17:30:00Z"), NOW)).toBe("Hôm nay");
    expect(dayLabel(luc("2026-09-10T16:30:00Z"), NOW)).toBe("Hôm qua");
    expect(dayLabel(luc("2026-09-12T09:00:00+07:00"), NOW)).toBe("Hôm nay");
  });
});

describe("openLabel", () => {
  it("gio, thu, ngay thang nam theo gio Viet Nam", () => {
    expect(openLabel(luc("2026-10-24T07:00:00+07:00"))).toBe("Mở lúc 07:00, thứ bảy 24.10.2026");
    expect(openLabel(luc("2026-12-24T17:00:00Z"))).toBe("Mở lúc 00:00, thứ sáu 25.12.2026");
    expect(openLabel(luc("2026-09-13T08:00:00+07:00"))).toBe("Mở lúc 08:00, chủ nhật 13.09.2026");
  });
});

describe("haiChuSo", () => {
  it("dem so it nhat hai chu so, so dai hon giu nguyen", () => {
    expect(haiChuSo(4)).toBe("04");
    expect(haiChuSo(12)).toBe("12");
    expect(haiChuSo(3653)).toBe("3653");
  });
});

describe("editedLabel", () => {
  // 09:00 ngay 20.09 gio Viet Nam.
  const BAY_GIO = luc("2026-09-20T02:00:00Z");

  it("cung ngay thi chi co gio", () => {
    expect(editedLabel(luc("2026-09-20T00:30:00Z"), BAY_GIO)).toBe("Đã sửa lúc 07:30");
  });

  it("ngay tinh theo gio Viet Nam, qua nua dem la ngay moi", () => {
    expect(editedLabel(luc("2026-09-19T17:30:00Z"), BAY_GIO)).toBe("Đã sửa lúc 00:30");
    expect(editedLabel(luc("2026-09-19T16:30:00Z"), BAY_GIO)).toBe("Đã sửa lúc 23:30 hôm qua");
  });

  it("cung nam thi them ngay thang, khac nam thi them ca nam", () => {
    expect(editedLabel(luc("2026-09-18T07:05:00Z"), BAY_GIO)).toBe("Đã sửa lúc 14:05, 18.09");
    expect(editedLabel(luc("2025-09-20T07:05:00Z"), BAY_GIO)).toBe("Đã sửa lúc 14:05, 20.09.2025");
  });
});

describe("dateLabel", () => {
  it("ngay thang, khac nam thi them nam", () => {
    const bayGio = luc("2026-09-20T02:00:00Z");
    expect(dateLabel(luc("2026-09-18T07:05:00Z"), bayGio)).toBe("18.09");
    expect(dateLabel(luc("2025-09-20T07:05:00Z"), bayGio)).toBe("20.09.2025");
  });
});

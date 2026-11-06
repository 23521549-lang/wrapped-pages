// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import type { FeedItem } from "@/lib/feed/types";

/*
 * Khung Hoat dong trong khi bat Khoang Lang (task 3): cau trong khi khong co dong nao khong duoc nhac ten
 * doi phuong; cau cu (co ten) chi hien khi tat co.
 *
 * TheoDoiXem keo "@/app/actions/feed" (file "use server") nen phai mock nhu test cai-dat-hoat-dong: chi can
 * actionSeenActivity, khong goi that trong bai nay.
 */
vi.mock("@/app/actions/feed", () => ({
  actionSeenActivity: vi.fn(async () => ({ ok: true })),
}));

const NOW = new Date("2026-09-15T08:00:00.000Z");

const dongCuaMinh: FeedItem = {
  id: "11111111-1111-4111-8111-111111111111", kind: "dang-trang", by: "me", at: NOW,
  bookId: "22222222-2222-4222-8222-222222222222", bookTitle: "Chuyện chưa kể",
  firstPosition: 1, lastPosition: 1, sealKind: null, count: 1, note: null, isNew: false,
  detail: null, weather: null, biaMoi: false, nhacMoi: false, ordinal: null, tenLuot: null,
};

describe("ActivityPanel duoi Khoang Lang", () => {
  it("tat co thi cau trong goi ten doi phuong nhu cu", () => {
    render(<ActivityPanel items={[]} now={NOW} partnerName="Linh" an={false} khoangLang={false} />);
    expect(screen.getByText("Linh đăng trang hay mở một trang khóa thì tin hiện ở đây.")).toBeDefined();
  });

  it("bat co thi cau trong khong nhac ten doi phuong", () => {
    const { container } = render(<ActivityPanel items={[]} now={NOW} partnerName="Linh" an={false} khoangLang={true} />);
    expect(container.textContent).not.toContain("Linh");
    expect(container.textContent).toContain("Đăng trang hay mở một trang khóa thì tin hiện ở đây.");
  });

  it("bat co thi dong cua minh van hien, khong lo ten doi phuong", () => {
    const { container } = render(
      <ActivityPanel items={[dongCuaMinh]} now={NOW} partnerName="Linh" an={false} khoangLang={true} />,
    );
    expect(container.textContent).toContain("Bạn");
    expect(container.textContent).not.toContain("Linh");
  });
});

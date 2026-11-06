import { createElement, Suspense } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import { HoatDongCoTenBai } from "@/components/feed/HoatDongCoTenBai";
import type { FeedItem } from "@/lib/feed/types";
import type { TenBaiHat } from "@/lib/feed/line";

// Vung cuon theo doi dau Moi goi action da xem; o day chi ve, khong gui gi (theo activity-panel.test.tsx).
vi.mock("@/app/actions/feed", () => ({ actionSeenActivity: vi.fn(async () => ({ ok: true })) }));

/*
 * STREAM TEN BAI cua khung Hoat dong. Ten bai lay tu YouTube (toi da 1,5s) khong duoc chan trang Ke sach ve:
 * khung ve truoc voi cau thay "Bản nhạc trên YouTube" (y nhu khi lay khong duoc), ten that stream ve sau khi
 * promise xong. Bai nay khoa lai bang luong render that cua React: chunk dau tien phai ve khi promise chua xong.
 * File .ts (khong JSX) de chay o project node: renderToReadableStream chi co o ban server cua react-dom.
 */

const NOW = new Date("2026-10-01T02:00:00.000Z");
const YOUTUBE_ID = "dQw4w9WgXcQ";

const dongDoiNhac: FeedItem = {
  id: "dong-1", kind: "doi-nhac", by: "me", at: NOW,
  bookId: "sach-1", bookTitle: "Chuyện chưa kể",
  firstPosition: 1, lastPosition: 1, sealKind: null, note: null, count: 1, isNew: false,
  detail: { truoc: null, sau: { youtubeId: YOUTUBE_ID } },
  weather: null, biaMoi: false, nhacMoi: false, ordinal: 1, tenLuot: null,
};

const props = { items: [dongDoiNhac], now: NOW, partnerName: "Linh", an: false, khoangLang: false };

function cay(baiHat: Promise<TenBaiHat>) {
  // Cay co noi dung dong bo ngoai Suspense (tieu de trang) nhu trang Ke sach that: nav, ke sach, khung lon
  // ve ngay cung fallback, chi phan ten bai cho promise.
  return createElement(
    "div",
    null,
    createElement("h1", null, "Kệ sách"),
    createElement(
      Suspense,
      { fallback: createElement(ActivityPanel, props) },
      createElement(HoatDongCoTenBai, { ...props, baiHat }),
    ),
  );
}

describe("khung Hoat dong stream ten bai", () => {
  it("chunk dau ve ngay khi YouTube chua tra: cau thay, khong cho promise", async () => {
    const khongBaoGioXong = new Promise<TenBaiHat>(() => {});
    const stream = await renderToReadableStream(cay(khongBaoGioXong));
    const reader = stream.getReader();
    try {
      const dau = await Promise.race([
        reader.read().then((r) => ({ hetHan: false, text: new TextDecoder().decode(r.value) })),
        new Promise<{ hetHan: boolean; text: string }>((xong) => setTimeout(() => xong({ hetHan: true, text: "" }), 1000)),
      ]);
      expect(dau.hetHan).toBe(false);
      expect(dau.text).toContain("Kệ sách");
      expect(dau.text).toContain("Bản nhạc trên YouTube");
      expect(dau.text).toContain("đổi nhạc lượt 1");
    } finally {
      await reader.cancel();
    }
  });

  it("promise xong: ten that stream ve sau", async () => {
    const baiHat = Promise.resolve({ [YOUTUBE_ID]: { ten: "Tên bài test", kenh: "Kênh test" } });
    const stream = await renderToReadableStream(cay(baiHat));
    const html = await new Response(stream).text();
    expect(html).toContain("Tên bài test, Kênh test");
  });
});

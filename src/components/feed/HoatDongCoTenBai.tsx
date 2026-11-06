import { ActivityPanel, type ActivityPanelProps } from "./ActivityPanel";
import type { TenBaiHat } from "@/lib/feed/line";

type HoatDongCoTenBaiProps = Omit<ActivityPanelProps, "baiHat"> & { baiHat: Promise<TenBaiHat> };

/**
 * Khung Hoat dong kem ten bai YouTube (Ke sach): component may chu bat dong bo, cho promise ten bai xong moi
 * ve. Dung trong <Suspense> voi fallback la ActivityPanel khong ten bai, de ten bai (hoi YouTube toi da 1,5s)
 * khong chan trang ve: khung ve truoc voi cau thay "Bản nhạc trên YouTube" (y nhu khi lay khong duoc), ten
 * that stream ve sau. tests/unit/hoat-dong-stream.test.tsx khoa lai.
 */
export async function HoatDongCoTenBai({ baiHat, ...conLai }: HoatDongCoTenBaiProps) {
  return <ActivityPanel {...conLai} baiHat={await baiHat} />;
}

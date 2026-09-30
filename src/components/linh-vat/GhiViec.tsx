"use client";

import { useEffect } from "react";
import { timeLabel } from "@/lib/when";
import { ghiViec, tenTrang } from "./viec";

/**
 * Ghi mot dong "HH:MM mở {trang}" moi lan mot trang da dang nhap duoc mo (5e, spec D3), ke ca man doc va man viet (noi Chip
 * khong ngoi), de khi hoi, Chip biet nguoi dung vua lam gi. Khong ve gi.
 */
export function GhiViec() {
  useEffect(() => {
    // Khung hinh sau: tieu de trang da ve xong.
    const k = requestAnimationFrame(() => ghiViec(`${timeLabel(new Date())} mở ${tenTrang()}`));
    return () => cancelAnimationFrame(k);
  }, []);
  return null;
}

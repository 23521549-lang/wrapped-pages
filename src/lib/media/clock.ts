/** Nhan dong ho m:ss cua mot moc thoi gian, lam tron xuong toi giay: dong ho dang chay khong bao gio chay truoc. */
export function clockLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Nhan do dai m:ss cua mot doan, lam tron len toi giay: doan ngan hon mot giay la 0:01, khong bao gio 0:00. */
export function durationLabel(ms: number): string {
  return clockLabel(Math.ceil(ms / 1000) * 1000);
}

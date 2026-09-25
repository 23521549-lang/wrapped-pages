import { congDoc } from "@/server/web/cong";

/**
 * Cong: cuon doc duoc (cua minh, hay cuon chia se cua nguoi kia), xet truoc khung giu cho de cuon rieng tu cua nguoi kia
 * van tra ma 404 y nhu cuon khong ton tai.
 */
export default async function Cong({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await congDoc((await params).id);
  return children;
}

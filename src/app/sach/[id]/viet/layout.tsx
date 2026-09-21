import { congSachCuaToi } from "@/server/web/cong";

/** Cong: chi cuon cua chinh minh, xet truoc khung giu cho (loading.tsx) de sach cua nguoi kia van tra ma 404. */
export default async function Cong({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await congSachCuaToi((await params).id);
  return children;
}

import { congSuaLuot } from "@/server/web/cong";

/** Cong man sua mot luot, xet truoc khung giu cho (loading.tsx) de luot la hay sach la van tra ma 404. */
export default async function CongSuaLuot({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ id: string; luot: string }>;
}) {
  const { id, luot } = await params;
  await congSuaLuot(id, luot);
  return children;
}

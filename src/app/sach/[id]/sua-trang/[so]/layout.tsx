import { congSuaTrang } from "@/server/web/cong";

/** Cong man sua mot to, xet truoc khung giu cho (loading.tsx) de to la hay sach la van tra ma 404. */
export default async function CongSuaTrang({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ id: string; so: string }>;
}) {
  const { id, so } = await params;
  await congSuaTrang(id, so);
  return children;
}

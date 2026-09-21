import { congDoc } from "@/server/web/cong";

/** Cong man doc, dung truoc khung giu cho (loading.tsx) de cuon khong doc duoc van tra ma 404. */
export default async function CongDoc({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await congDoc((await params).id);
  return children;
}

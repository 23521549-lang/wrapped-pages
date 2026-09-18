import type { NextConfig } from "next";

/**
 * Tai media len di qua server action. Tep da xu ly o trinh duyet toi da 1 MB cho anh va bia, 2 MB cho ghi am
 * (MEDIA_MAX_BYTES); tran body tinh ca phan thua multipart, nen dat 3mb (co test). Tran nay ap cho moi server action.
 */
const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};
export default nextConfig;

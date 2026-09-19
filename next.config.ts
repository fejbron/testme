import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@vercel/sandbox", "@prisma/client"],
  eslint: { ignoreDuringBuilds: true },
  // Ensure campaign manifests are bundled so the admin publish route can read them at runtime.
  outputFileTracingIncludes: {
    "/api/admin/campaigns/publish": ["./challenges/**/campaign.yaml"],
  },
};
export default nextConfig;

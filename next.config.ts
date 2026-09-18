import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@vercel/sandbox", "@prisma/client"],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;

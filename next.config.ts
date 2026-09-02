import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Claim evidence uploads allow files up to 5 MB; the default 1 MB action
      // body limit made 1–5 MB uploads 500 before validation could run.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;

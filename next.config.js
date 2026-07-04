/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No ESLint config is shipped; don't block the production build on linting.
  eslint: { ignoreDuringBuilds: true },
  // sharp is a native dep used only in server route handlers; keep it external
  // so Next doesn't try to bundle its binaries.
  serverExternalPackages: ['sharp'],
};

export default nextConfig;

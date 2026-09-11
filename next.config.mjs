/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Default Server Action body limit is 1MB — too small for evidence
    // uploads (screenshots, signed PDFs). See src/app/evidence/actions.ts.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

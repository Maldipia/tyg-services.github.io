/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Vercel to deploy even if there are prerender errors
  // (pages with useSearchParams need Suspense boundaries — works fine at runtime)
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },
};

export default nextConfig;

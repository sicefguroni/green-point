import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dummyimage.com'
      },
      {
        protocol: 'https',
        hostname: 'avatar.iran.liara.run'
      },
    ],
  },
  async rewrites() {
    const modelApiUrl = process.env.NEXT_PUBLIC_MODEL_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/model/:path*',
        destination: `${modelApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

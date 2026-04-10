import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "react-icons",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-slider",
      "sonner",
      "zustand",
      "embla-carousel-react",
      "@mapbox/search-js-react",
    ],
  },
  /** Long cache for static GeoJSON in /public/geo (choropleth + merge pipeline). */
  async headers() {
    return [
      {
        source: "/geo/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dummyimage.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;

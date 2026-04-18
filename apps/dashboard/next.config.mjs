/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  optimizeFonts: false,
  transpilePackages: ["@anthyx/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000",
    NEXT_PUBLIC_PRODUCT_NAME: "Anthyx",
  },
};

export default nextConfig;

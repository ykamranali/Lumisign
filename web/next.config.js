/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so the dashboard can be served by the Express server in a single container.
  output: 'export',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || '',
  },
};

module.exports = nextConfig;

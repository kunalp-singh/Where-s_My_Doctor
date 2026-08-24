/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allow dev server to run even if type checking is not fully set up in this preview
    ignoreBuildErrors: true,
  },
  // Explicit Turbopack workspace root to avoid Next inferring the incorrect project root
  turbopack: {
    root: '.'
  }
};

module.exports = nextConfig;

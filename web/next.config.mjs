const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // Browser calls /api/v1/* on this domain and Next forwards them to the API (no CORS, one domain for buyers).
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_BASE_URL}/:path*` }];
  },
};

export default nextConfig;

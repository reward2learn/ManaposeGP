/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ['192.168.1.103', 'localhost'],
  async redirects() {
    return [
      { source: '/dashboard', destination: '/health-dashboard', permanent: false },
      { source: '/ops-chat', destination: '/consultation-assist', permanent: false },
      { source: '/gp-prep', destination: '/consultation-assist', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/api/auth/callback/google', destination: '/api/auth?action=google-callback' },
      { source: '/api/monthly-actuals', destination: '/api/financial-overview?resource=monthly-actuals' },
      { source: '/api/pos-scan', destination: '/api/pos?action=scan' },
      { source: '/api/pos-parse', destination: '/api/pos?action=parse' },
      { source: '/api/voice', destination: '/api/chat?resource=voice' },
      { source: '/api/conversations', destination: '/api/chat?resource=conversations' },
      { source: '/api/reports', destination: '/api/financial-overview?resource=reports' },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // XSS protection (legacy browsers)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Referrer policy — don't leak URL params
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy — disable unused APIs
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // HSTS — enforce HTTPS for 1 year
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // CSP — tight policy for POS app
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + inline (Next.js hydration) + Google Fonts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (inline styles we use everywhere) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + Supabase storage + data URIs
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://api.qrserver.com",
      // Connect: self + Supabase (REST + Realtime) + PayMongo
      "connect-src 'self' https://srgimbdbyrrijlppvkrn.supabase.co wss://srgimbdbyrrijlppvkrn.supabase.co https://api.paymongo.com https://*.upstash.io",
      // Frames: same origin only
      "frame-src 'self'",
      // Form actions: self only
      "form-action 'self'",
      // Base URI: prevent base tag injection
      "base-uri 'self'",
      // Object/embed: none
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,

  // Security headers on all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // CORS for public API endpoints (order + menu)
      {
        source: '/api/orders',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      {
        source: '/api/menu',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      {
        source: '/api/orders/track',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      // No-cache on API routes
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'srgimbdbyrrijlppvkrn.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;

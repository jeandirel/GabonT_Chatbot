import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** React / Next en développement ont besoin de `unsafe-eval` ; jamais utilisé en production. */
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const moovHttp = (
  process.env.NEXT_PUBLIC_MOOV_API_URL ||
  "https://api-production-c0fd.up.railway.app"
).replace(/\/$/, "");
const moovWs = moovHttp.replace(/^http/, "ws");
const connectSrc = isDev
  ? "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*"
  : `connect-src 'self' ${moovHttp} ${moovWs}`;

const csp = [
  "default-src 'self'",
  connectSrc,
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  scriptSrc,
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;

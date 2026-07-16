import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Heavy native/worker packages must not be bundled into server routes.
  serverExternalPackages: ["pdfjs-dist", "tesseract.js", "@napi-rs/canvas"],
};

export default nextConfig;

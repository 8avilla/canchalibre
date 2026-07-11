import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // Default es 1 MB — muy poco para subir varias fotos de cancha (hasta 8 × 5 MB) en un solo
      // envío del formulario de /admin/canchas.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;

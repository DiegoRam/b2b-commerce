import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@medusajs/js-sdk'],
  webpack: (config) => {
    // Handle MedusaJS SDK imports
    config.externals = config.externals || []
    config.externals.push({
      '@medusajs/js-sdk': '@medusajs/js-sdk'
    })
    return config
  }
};

export default nextConfig;

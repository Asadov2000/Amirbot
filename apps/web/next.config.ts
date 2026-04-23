import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@amir/db", "@amir/ui", "@amir/shared"],
  turbopack: {
    root: path.resolve(process.cwd(), "../..")
  }
};

export default nextConfig;

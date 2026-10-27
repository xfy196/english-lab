import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 关闭开发模式的悬浮指示器，避免遮挡左侧边栏
  devIndicators: false,
  // 允许通过环境变量切换构建输出目录
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 明确工程根目录，避免上层目录存在其他 lockfile 时被误判为 workspace root
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

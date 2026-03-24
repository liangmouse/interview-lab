import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 创建 next-intl 插件，指向 request config 文件
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // 避免 next dev 与 next build 共享同一份产物目录，导致运行中产物互相覆盖。
  distDir: isProductionBuild ? ".next" : ".next-dev",
  // 启用更详细的错误信息
  productionBrowserSourceMaps: true,

  // Webpack 配置
  webpack: (config, { dev }) => {
    if (dev) {
      // 开发环境下禁用压缩
      config.optimization.minimize = false;
    }

    return config;
  },
  // 构建时不因规范等预期外问题失败
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);

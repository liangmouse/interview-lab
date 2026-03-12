import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 创建 next-intl 插件，指向 request config 文件
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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

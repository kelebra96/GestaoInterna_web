import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otimizações de segurança e compressão
  poweredByHeader: false,
  compress: true,

  // Otimizações de performance
  reactStrictMode: true,

  // Ignorar ESLint durante build (warnings não devem bloquear deploy)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Otimização de imagens
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Mover pacotes pesados para external (melhora tempo de build)
  serverExternalPackages: [
    '@opentelemetry/instrumentation',
    '@opentelemetry/api',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/sdk-trace-node',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/core',
    '@opentelemetry/context-async-hooks',
    '@sentry/nextjs',
    'firebase-admin',
    'mongodb',
    '@prisma/client',
    'pg',
  ],

  // Configurações experimentais para melhor performance
  experimental: {
    // Otimiza imports de pacotes
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      '@radix-ui/react-tabs',
    ],
  },
};

export default nextConfig;

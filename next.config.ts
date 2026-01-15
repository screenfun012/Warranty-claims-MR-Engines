import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Eksplicitno eksportuj Auth0 environment varijable
  env: {
    AUTH0_SECRET: process.env.AUTH0_SECRET,
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  },
  // Enable better source maps for debugging (for webpack fallback)
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.devtool = 'eval-source-map';
      
      // Ignore file watcher za database i storage da spreči Fast Refresh petlje
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/storage/**',
          '**/*.db',
          '**/*.db-journal',
          '**/tsconfig.tsbuildinfo',
          '**/dev.db',
          '**/prisma/dev.db',
        ],
      };
    }
    
    // Ignore README.md files in node_modules (fix for @libsql packages)
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
      include: /node_modules/,
    });
    
    // Externalize libsql on server to avoid bundling issues
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@libsql/client', '@libsql/isomorphic-fetch');
      }
    }
    
    if (!dev && !isServer) {
      // Code splitting optimizacije za production
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 20,
            },
          },
        },
      };
    }
    
    return config;
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-label',
      '@radix-ui/react-separator',
      '@radix-ui/react-switch',
      '@radix-ui/react-progress',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-hover-card',
    ],
  },
};

export default nextConfig;

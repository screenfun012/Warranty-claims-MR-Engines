import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Configure Turbopack (Next.js 16 default)
  turbopack: {},
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

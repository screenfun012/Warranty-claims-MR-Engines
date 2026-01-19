import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

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
    // Ignore README.md and other markdown files in node_modules
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    
    // Ignore .d.ts files (TypeScript definitions) - they shouldn't be bundled
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: {
        loader: 'null-loader',
      },
    });
    
    // Ignore libsql internal files that cause build issues
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Add fallback to ignore problematic files
    config.resolve.fallback = config.resolve.fallback || {};
    
    if (isServer) {
      // For server-side, externalize libsql packages
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          '@libsql/core': 'commonjs @libsql/core',
          '@libsql/client': 'commonjs @libsql/client',
        });
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          originalExternals,
          ({ request }: { request?: string }) => {
            if (request?.includes('@libsql/core') || request?.includes('@libsql/client')) {
              return true;
            }
            return false;
          },
        ];
      }
    }
    
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.auth0.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 's.gravatar.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.auth0.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        pathname: '**',
      },
    ],
    // Disable optimization for external images to avoid 400 errors
    unoptimized: false,
    // Allow images from any domain (less secure but ensures compatibility)
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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

export default withNextIntl(nextConfig);

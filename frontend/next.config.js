const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  // Skip type checking during builds to allow development
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/webp'],
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Important: return the modified config
    config.module.rules.push({
      test: /\.mjs$/,
      enforce: 'pre',
      use: ['source-map-loader'],
    });

    // YOLO/ONNX Runtime Configuration (client-side only)
    if (!isServer) {
      // Copy ONNX Runtime WASM files to static directory
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: 'node_modules/onnxruntime-web/dist/*.wasm',
              to: 'static/chunks/[name][ext]',
            },
            {
              from: 'node_modules/onnxruntime-web/dist/*.mjs',
              to: 'static/chunks/[name][ext]',
            },
            {
              from: 'public/models',
              to: 'static/chunks/models',
              noErrorOnMissing: true, // Don't fail if models directory is empty
            },
          ],
        })
      );

      // Configure WASM support
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      };

      // Prevent ONNX Runtime from being bundled on server
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };

      // Handle WASM files
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });
    }

    return config;
  },
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

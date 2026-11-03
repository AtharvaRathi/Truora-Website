import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: { '/*': ['./.local/**/*', './tests/**/*'] },
};

export default nextConfig;

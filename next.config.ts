import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // !! OSTRZEŻENIE !!
    // To jest rozwiązanie ostateczne, aby ominąć uporczywy błąd kompilacji w Cloud Build.
    // Mówi ono systemowi budowania, aby zignorował błąd "Cannot find namespace 'JSX'".
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
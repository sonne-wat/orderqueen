/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 빌드 시 타입 오류가 있어도 무시하고 배포함
    ignoreBuildErrors: true,
  },
  eslint: {
    // 빌드 시 코드 규칙 오류가 있어도 무시하고 배포함
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

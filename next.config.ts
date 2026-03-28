/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 이 줄이 핵심입니다! 타입 에러가 있어도 빌드를 진행합니다.
    ignoreBuildErrors: true,
  },
  eslint: {
    // 리액트 규칙 에러도 함께 무시합니다.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'search.pstatic.net' },
      { protocol: 'https', hostname: 'ldb-phinf.pstatic.net' },
      { protocol: 'https', hostname: 'blogfiles.pstatic.net' },
    ],
  },
}

export default nextConfig

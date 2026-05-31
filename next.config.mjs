/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.1.38',
    '192.168.1.38:3000',
    '192.168.1.100',
    '192.168.1.100:3000',
    '192.168.0.100',
    '192.168.0.100:3000',
    '10.0.0.1',
    '10.0.0.1:3000',
  ]
};

export default nextConfig;

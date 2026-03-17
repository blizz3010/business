/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_CITY_CENTER_LAT: process.env.NEXT_PUBLIC_CITY_CENTER_LAT,
    NEXT_PUBLIC_CITY_CENTER_LNG: process.env.NEXT_PUBLIC_CITY_CENTER_LNG
  }
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app only fetches data client-side (no getServerSideProps, no
  // API routes), so it can ship as plain static HTML/JS/CSS - no
  // Node runtime needed on the host. Netlify/Vercel/any static host
  // can serve the `out` folder directly.
  output: "export",
};

module.exports = nextConfig;
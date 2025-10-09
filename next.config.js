/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	productionBrowserSourceMaps: true,
	experimental: {
		typedRoutes: true
	},
	eslint: { ignoreDuringBuilds: true },
	webpack: (config, { dev, isServer }) => {
		// Ensure source maps in production for client bundles
		if (!dev && !isServer) {
			config.devtool = "source-map";
		}
		return config;
	}
};

module.exports = nextConfig;

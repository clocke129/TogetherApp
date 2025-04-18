import withPWAInit from "next-pwa";

// Import user config if it exists
let userConfig = undefined;
try {
  // Assuming v0-user-next.config exports a default object
  // Use .js extension if that's the actual file name
  const userModule = await import('./v0-user-next.config.js');
  userConfig = userModule.default;
} catch (e) {
  // ignore error if file doesn't exist or fails to import
  console.log("Note: No v0-user-next.config found or import failed.");
}

/** @type {import('next').NextConfig} */
const baseNextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
};

// Function to merge configs (revised to return the merged config)
function mergeConfig(baseConfig, userProvidedConfig) {
  if (!userProvidedConfig) {
    return { ...baseConfig }; // Return a copy of base if no user config
  }

  const merged = { ...baseConfig }; // Start with a copy of the base

  for (const key in userProvidedConfig) {
    // Check if the key exists in the user config and it's not inherited
    if (Object.prototype.hasOwnProperty.call(userProvidedConfig, key)) {
      const baseValue = merged[key];
      const userValue = userProvidedConfig[key];

      if (
        typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue) &&
        typeof userValue === 'object' && userValue !== null && !Array.isArray(userValue)
      ) {
        // Deep merge objects (simple one level)
        merged[key] = { ...baseValue, ...userValue };
      } else {
        // Otherwise, user value overrides base value
        merged[key] = userValue;
      }
    }
  }
  return merged; // Return the result
}

// Merge the base config with the user config first
const nextConfig = mergeConfig(baseNextConfig, userConfig);

// Configure next-pwa
const withPWA = withPWAInit({
  dest: "public", // Destination directory for service worker files
  register: true, // Register the service worker
  skipWaiting: true, // Install new service worker immediately
  disable: process.env.NODE_ENV === "development", // Disable PWA in development mode
  runtimeCaching: [], // <-- Add this line to clear default caching rules
  buildExcludes: [/app-build-manifest\.json$/] // <-- Add this line
});

// Wrap the final merged config with PWA capabilities
export default withPWA(nextConfig);

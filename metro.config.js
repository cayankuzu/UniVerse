const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure Metro can always resolve react-native-reanimated from project root
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    "expo-clipboard": path.resolve(__dirname, "node_modules/expo-clipboard"),
    "react-native-reanimated": path.resolve(__dirname, "node_modules/react-native-reanimated"),
  },
};

// Defer require() evaluation until first use so screen/module JS only pays
// its import cost when it is actually touched (faster startup + faster
// first navigation into any lazily-required feature module).
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: { experimentalImportSupport: false, inlineRequires: true },
  }),
};

module.exports = wrapWithReanimatedMetroConfig(config);

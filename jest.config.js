module.exports = {
  preset: "jest-expo",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.env.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/mobile/**/*.test.ts", "<rootDir>/src/mobile/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/android/"],
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|@noble/hashes|react-navigation|@react-navigation|@sentry/react-native|native-base))",
    "/node_modules/react-native-reanimated/plugin/",
  ],
  collectCoverageFrom: [
    "<rootDir>/src/mobile/app/**/*.{ts,tsx}",
    "!<rootDir>/src/mobile/app/**/*.test.{ts,tsx}",
    "!<rootDir>/src/mobile/app/**/index.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {
      branches: 32,
      functions: 40,
      lines: 42,
      statements: 40,
    },
  },
};

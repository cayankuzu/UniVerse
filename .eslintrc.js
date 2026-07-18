module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    "react-native/react-native": true,
    es2021: true,
    jest: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "react-native"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // Warn on unused variables (allow underscore-prefixed)
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],

    // Warn on explicit any usage
    "@typescript-eslint/no-explicit-any": "warn",

    // Warn on console usage, but allow console.error
    "no-console": ["warn", { allow: ["error"] }],

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // React 17+ JSX transform — no need to import React
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",

    // Allow .tsx files for JSX
    "react/jsx-filename-extension": ["warn", { extensions: [".tsx", ".jsx"] }],

    // Existing cleanup signals that should not block the first release lint gate.
    "@typescript-eslint/no-empty-object-type": "warn",
    "@typescript-eslint/no-require-imports": "off",
    "no-constant-condition": "warn",
    "no-empty": "warn",
    "no-extra-boolean-cast": "warn",
    "no-unsafe-finally": "warn",
    "prefer-const": "warn",
    "react/display-name": "warn",
    "react/no-unescaped-entities": "warn",
  },
  overrides: [
    {
      // Relax stricter rules for test files
      files: [
        "**/__tests__/**/*.[jt]s?(x)",
        "**/*.test.[jt]s?(x)",
        "**/*.spec.[jt]s?(x)",
        "jest.setup.ts",
        "jest.env.js",
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
    {
      files: ["load-tests/**/*.js"],
      globals: {
        __ENV: "readonly",
      },
    },
  ],
};

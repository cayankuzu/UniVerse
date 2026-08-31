import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

process.env.ORIGIN_HMAC_SECRET ??= "test-origin-secret-that-is-at-least-32-bytes";
process.env.RATE_LIMIT_SALT ??= "test-rate-limit-salt-that-is-at-least-32-bytes";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test_abcdefghijklmnopqrstuvwxyz";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: {
          ORIGIN_HMAC_SECRET: "test-origin-secret-that-is-at-least-32-bytes",
          RATE_LIMIT_SALT: "test-rate-limit-salt-that-is-at-least-32-bytes",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_abcdefghijklmnopqrstuvwxyz",
        },
      },
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const requireFile = (relativePath) => {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing performance asset: ${relativePath}`);
  }
};
const requireText = (relativePath, pattern, message) => {
  if (!pattern.test(read(relativePath))) throw new Error(message);
};

const budgets = JSON.parse(read("config/performance-budgets.json"));
if (budgets.splashMaxWaitMs > 900 || budgets.tapResponseP95Ms > 100) {
  throw new Error("Interactive performance budgets were relaxed.");
}

requireText(
  "src/mobile/app/data/projections/networkAwareBudget.ts",
  /currentQuality:\s*NetworkQuality\s*=\s*"unknown"/,
  "Network prefetch must remain conservative before NetInfo resolves.",
);
requireText(
  "src/mobile/app/data/projections/projections.warmup.transport.ts",
  /AbortController/,
  "Warmup RPC timeout must abort its request.",
);
requireText(
  "src/mobile/app/shared/performance/performanceBudget.ts",
  /warmupRpcTimeoutMs:\s*900/,
  "Warmup timeout must stay non-blocking and bounded.",
);
requireText(
  "src/mobile/app/app-shell/bridges/useProjectionRealtimeBridgeService.ts",
  /hydrateNotificationPresence/,
  "Notification presence must remain event-driven.",
);
if (
  /setInterval\s*\(/.test(
    read("src/mobile/app/app-shell/bridges/useProjectionRealtimeBridgeService.ts"),
  )
) {
  throw new Error("Realtime bridge must not poll on a fixed interval.");
}

requireFile("android/app/src/main/baseline-prof.txt");
requireFile("utils/ops/generate-android-baseline-profile.ps1");
requireFile(
  "android/macrobenchmark/src/main/java/com/ogrencisosyalagi/macrobenchmark/StartupBenchmark.kt",
);

const generatedBundle = path.join(
  root,
  "android/app/build/generated/assets/react/release/index.android.bundle",
);
if (
  fs.existsSync(generatedBundle) &&
  fs.statSync(generatedBundle).size > budgets.androidBundleJsBytesMax
) {
  throw new Error(
    `Android JS bundle exceeds ${budgets.androidBundleJsBytesMax} bytes: ${fs.statSync(generatedBundle).size}`,
  );
}

console.log("Performance contract guard passed.");

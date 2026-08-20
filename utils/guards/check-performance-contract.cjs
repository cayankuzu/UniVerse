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
if (
  budgets.splashMaxWaitMs > 900 ||
  budgets.tapResponseP95Ms > 100 ||
  budgets.firstFrameP95Ms > 700 ||
  budgets.firstCachedContentP95Ms > 850 ||
  budgets.interactiveP95Ms > 1_200 ||
  budgets.navigationResponseP95Ms > 300 ||
  budgets.jsFrameBudgetMs > 16.67 ||
  budgets.feedFpsP50Min < 55 ||
  budgets.feedBlankAreaP95PxMax > 8 ||
  budgets.mediaCacheHitRateMin < 0.65 ||
  budgets.projectionRpcP95Ms > 1_200 ||
  budgets.projectionRpcP99Ms > 2_500 ||
  budgets.projectionPayloadP95BytesMax > 180_000 ||
  budgets.warmupUsefulnessRateMin < 0.4
) {
  throw new Error("Interactive performance budgets were relaxed.");
}

requireText(
  "src/mobile/app/data/projections/networkAwareBudget.ts",
  /currentQuality:\s*NetworkQuality\s*=\s*"unknown"/,
  "Network prefetch must remain conservative before NetInfo resolves.",
);
requireText(
  "src/mobile/app/data/projections/networkAwareBudget.ts",
  /if \(powerConstrained\)[\s\S]*allowImagePrefetch:\s*false/,
  "Low power mode must suppress speculative media prefetch.",
);
requireText(
  "src/mobile/app/app-shell/startup/DeferredAppServices.tsx",
  /enableWarmup\s*=\s*[\s\S]*queryCacheReady/,
  "Warmup must start after the bounded cache gate instead of waiting forever for restore.",
);
requireText(
  "src/mobile/app/shared/media/MediaVideo.tsx",
  /priority:\s*active\s*&&\s*appActive\s*\?\s*"eager"\s*:\s*"deferred"/,
  "Inactive videos must not resolve remote media eagerly.",
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
requireFile(
  "android/macrobenchmark/src/main/java/com/ogrencisosyalagi/macrobenchmark/CriticalJourneyBenchmark.kt",
);
requireText(
  "android/macrobenchmark/src/main/java/com/ogrencisosyalagi/macrobenchmark/StartupBenchmark.kt",
  /StartupMode\.WARM[\s\S]*StartupMode\.HOT/,
  "Android startup benchmarks must cover warm and hot launches.",
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

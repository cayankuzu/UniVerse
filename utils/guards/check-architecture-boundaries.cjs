const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MOBILE_APP_ROOT = path.join(ROOT, "src", "mobile", "app");
const FEATURE_ROOT = path.join(MOBILE_APP_ROOT, "features");
const LEGACY_SHARED_PATH = path.join(ROOT, "src", "shared");
const SERVER_INDEX_PATH = path.join(ROOT, "supabase", "functions", "server", "index.ts");
const SERVER_REGISTRY_PATH = path.join(ROOT, "supabase", "functions", "server", "routeRegistry.ts");
const SERVER_RUNTIME_PATH = path.join(ROOT, "supabase", "functions", "server", "runtime.ts");
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.json");
const APP_ROOT_PATH = path.join(MOBILE_APP_ROOT, "App.tsx");
const ROOT_NAVIGATION_SCREENS_PATH = path.join(
  MOBILE_APP_ROOT,
  "app-shell",
  "navigation",
  "rootNavigationScreens.tsx",
);
const AUTH_NAVIGATOR_PATH = path.join(
  MOBILE_APP_ROOT,
  "app-shell",
  "navigation",
  "navigators",
  "AuthNavigator.tsx",
);
const MAIN_TABS_NAVIGATOR_PATH = path.join(
  MOBILE_APP_ROOT,
  "app-shell",
  "navigation",
  "navigators",
  "MainTabsNavigator.tsx",
);
const MEDIA_VIEWER_PATH = path.join(MOBILE_APP_ROOT, "shared", "media", "MediaViewerModal.tsx");
const VIDEO_THUMBNAIL_CACHE_PATH = path.join(
  MOBILE_APP_ROOT,
  "shared",
  "media",
  "videoThumbnailCache.ts",
);
const DOWNLOAD_MEDIA_PATH = path.join(
  MOBILE_APP_ROOT,
  "shared",
  "media",
  "downloadMediaToGallery.ts",
);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;

const ALLOWED_SHARED_PLATFORM_IMPORTS = new Set();

const STALE_REFERENCE_PATTERNS = [
  "src/mobile/app/core",
  "src/mobile/app/lib",
  "src/mobile/app/infra",
  "src/mobile/app/navigation",
  "src/mobile/app/types",
  "src/mobile/app/i18n",
  "@core/",
  "@lib/",
  "@infra/",
  "@navigation/",
];

const STALE_REFERENCE_ALLOW_CONTEXTS = [
  "deleted legacy roots",
  "must not be reintroduced",
  "not part of the current app structure",
  "there is no",
  "there is no top-level",
  "does not use",
  "do not revive",
  "must not exist",
];

const forbiddenMigrationPaths = [
  "src/mobile/app/core",
  "src/mobile/app/lib",
  "src/mobile/app/infra",
  "src/mobile/app/navigation",
  "src/mobile/app/data/shared",
  "src/mobile/app/shared/hooks/useScreenSync.ts",
  "src/mobile/app/shared/hooks/useSupabaseDeepLinkBridge.ts",
  "src/mobile/app/shared/components/discovery",
  "src/mobile/app/shared/components/contentGrid",
  "src/mobile/app/types",
  "src/mobile/app/i18n",
  "src/mobile/app/data/query/index.ts",
  "src/mobile/app/platform/security/index.ts",
  "src/mobile/app/app-shell/startup/appWarmupState.ts",
];

const forbiddenSupabaseWorkingTreePaths = [
  "supabase/migrations_v2",
  "supabase/migrations_legacy_archive",
  "supabase/migrations_legacy_local_202603",
];

const requiredFeaturePublicContracts = [
  "src/mobile/app/features/content-cards/public/cards.ts",
  "src/mobile/app/features/content-cards/public/overlays.ts",
  "src/mobile/app/features/content-cards/public/presentation.ts",
  "src/mobile/app/features/content-cards/public/types.ts",
];

const featureRollbackEntryPattern =
  /^src\/mobile\/app\/features\/[^/]+\/rollback\.(ts|tsx|js|jsx)$/;
const featurePublicEntryPattern =
  /^src\/mobile\/app\/features\/[^/]+\/public\/[^/]+\.(ts|tsx|js|jsx)$/;

const requiredShellModules = [
  "src/mobile/app/app-shell/startup/appWarmupRuntime.ts",
  "src/mobile/app/app-shell/startup/appWarmup.shared.ts",
  "src/mobile/app/data/projections/index.ts",
  "src/mobile/app/app-shell/navigation/rootNavigation.constants.ts",
  "src/mobile/app/app-shell/navigation/rootNavigation.linking.ts",
  "src/mobile/app/app-shell/navigation/rootNavigationScreens.tsx",
  "src/mobile/app/app-shell/navigation/useRootNavigationController.ts",
];

const requiredFeatureModules = [
  "src/mobile/app/features/auth/data/index.ts",
  "src/mobile/app/features/auth/domain/index.ts",
  "src/mobile/app/features/events/data/index.ts",
  "src/mobile/app/features/events/domain/index.ts",
  "src/mobile/app/features/home/data/index.ts",
  "src/mobile/app/features/notifications/data/index.ts",
  "src/mobile/app/features/profile/data/index.ts",
  "src/mobile/app/features/profile/domain/index.ts",
  "src/mobile/app/features/search/data/index.ts",
  "src/mobile/app/features/search/domain/index.ts",
  "src/mobile/app/features/settings/data/index.ts",
];

const forbiddenLegacyScreenHooks = [
  "src/mobile/app/features/search/screens/useSearchScreenState.ts",
  "src/mobile/app/features/notifications/screens/useNotificationsScreenState.ts",
  "src/mobile/app/features/profile/screens/useViewProfileScreenState.ts",
  "src/mobile/app/features/profile/screens/useProfileScreenBootstrap.ts",
];

const HOT_PATH_FILE_LINE_LIMIT = 250;
const hotPathFiles = [
  "src/mobile/app/features/home/application/useHomeScreenState.ts",
  "src/mobile/app/features/home/application/useHomeProjectionState.ts",
  "src/mobile/app/features/search/application/useSearchResults.ts",
  "src/mobile/app/features/search/application/useSearchProjectionState.ts",
  "src/mobile/app/features/profile/application/useViewProfile.ts",
  "src/mobile/app/features/profile/application/useViewProfileOverviewState.ts",
  "src/mobile/app/features/profile/application/useOwnProfileScreenState.ts",
  "src/mobile/app/features/profile/application/useOwnProfileProjectionState.ts",
];

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function repoRelative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function assertSafeEntryName(entryName) {
  if (!entryName || entryName === "." || entryName === "..") {
    throw new Error(`Refusing to read unsafe path segment: ${entryName}`);
  }
  if (
    path.posix.basename(entryName) !== entryName ||
    path.win32.basename(entryName) !== entryName
  ) {
    throw new Error(`Refusing to read nested path segment: ${entryName}`);
  }
}

function listFiles(dirPath, collector = []) {
  if (!exists(dirPath)) return collector;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    assertSafeEntryName(entry.name);
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listFiles(fullPath, collector);
      continue;
    }
    if (entry.isFile()) {
      collector.push(fullPath);
    }
  }
  return collector;
}

function collectFilesFromRoots(roots) {
  const files = [];
  for (const rootEntry of roots) {
    if (!exists(rootEntry)) continue;
    const stat = fs.statSync(rootEntry);
    if (stat.isDirectory()) {
      listFiles(rootEntry, files);
      continue;
    }
    if (stat.isFile()) {
      files.push(rootEntry);
    }
  }
  return files;
}

function isTestFile(filePath) {
  return /\.(test|spec)(?:\.helpers)?\.(ts|tsx|js|jsx)$/.test(filePath);
}

function resolveInternalImport(fromFile, specifier) {
  const candidates = [];
  if (specifier.startsWith(".")) {
    const raw = path.resolve(path.dirname(fromFile), specifier);
    candidates.push(raw);
    candidates.push(`${raw}.ts`, `${raw}.tsx`, `${raw}.js`, `${raw}.jsx`);
    candidates.push(
      path.join(raw, "index.ts"),
      path.join(raw, "index.tsx"),
      path.join(raw, "index.js"),
      path.join(raw, "index.jsx"),
    );
  } else if (specifier.startsWith("src/mobile/")) {
    const raw = path.join(ROOT, specifier);
    candidates.push(raw);
    candidates.push(`${raw}.ts`, `${raw}.tsx`, `${raw}.js`, `${raw}.jsx`);
    candidates.push(
      path.join(raw, "index.ts"),
      path.join(raw, "index.tsx"),
      path.join(raw, "index.js"),
      path.join(raw, "index.jsx"),
    );
  } else {
    return null;
  }

  for (const candidate of candidates) {
    if (!exists(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isFile()) return candidate;
  }
  return null;
}

function getModuleInfo(filePath) {
  const rel = repoRelative(filePath);
  if (!rel.startsWith("src/mobile/app/")) {
    return {
      layer: "external",
      rel,
    };
  }

  const parts = rel.replace("src/mobile/app/", "").split("/");
  if (parts[0] === "features") {
    return {
      feature: parts[1] || "",
      layer: "features",
      rel,
      zone: parts[2] || "",
    };
  }

  return {
    layer: parts[0] || "",
    rel,
    zone: parts[1] || "",
  };
}

function isFeatureRootPublicEntry(relPath) {
  return /^src\/mobile\/app\/features\/[^/]+\/index\.(ts|tsx|js|jsx)$/.test(relPath);
}

function isFeatureRollbackEntry(relPath) {
  return featureRollbackEntryPattern.test(relPath);
}

function isFeatureNestedPublicEntry(relPath) {
  return featurePublicEntryPattern.test(relPath);
}

function isFeatureImportContract(relPath) {
  return (
    isFeatureRootPublicEntry(relPath) ||
    isFeatureRollbackEntry(relPath) ||
    isFeatureNestedPublicEntry(relPath)
  );
}

function isSameFeatureRootPublicEntry(fromInfo, relPath) {
  return (
    relPath === `src/mobile/app/features/${fromInfo.feature}/index.ts` ||
    relPath === `src/mobile/app/features/${fromInfo.feature}/index.tsx` ||
    relPath === `src/mobile/app/features/${fromInfo.feature}/index.js` ||
    relPath === `src/mobile/app/features/${fromInfo.feature}/index.jsx`
  );
}

function scanImports(files, failures) {
  const graph = new Map();

  for (const filePath of files) {
    const source = read(filePath);
    const deps = new Set();
    let match;
    while ((match = IMPORT_RE.exec(source))) {
      const target = resolveInternalImport(filePath, match[1]);
      if (target) deps.add(target);
    }
    graph.set(filePath, deps);
  }

  for (const filePath of files) {
    const fromInfo = getModuleInfo(filePath);
    const fromRel = fromInfo.rel;
    const source = read(filePath);

    if (
      fromRel !== "src/mobile/app/shared/components/AppModalHost.tsx" &&
      /import\s*\{[\s\S]*?\bModal\b[\s\S]*?\}\s*from\s*["']react-native["']/.test(source)
    ) {
      failures.push(
        `${fromRel} must use AppModalHost instead of mounting React Native Modal directly.`,
      );
    }

    if (
      fromInfo.layer === "features" &&
      fromInfo.zone === "ui" &&
      /\buseQueryClient\b/.test(source)
    ) {
      failures.push(`${fromRel} must not use QueryClient directly inside feature ui.`);
    }

    for (const target of graph.get(filePath) || []) {
      const toInfo = getModuleInfo(target);
      const toRel = toInfo.rel;
      const sharedAllowKey = `${fromRel} -> ${toRel}`;

      if (
        toRel === "utils/supabase/info.tsx" &&
        fromRel !== "src/mobile/app/platform/config/supabasePublic.ts"
      ) {
        failures.push(
          `${fromRel} must import Supabase public constants through platform/config/supabasePublic.ts.`,
        );
      }

      if (fromInfo.layer === "shared") {
        if (["app-shell", "features", "data"].includes(toInfo.layer)) {
          failures.push(`${fromRel} must not import ${toRel}; shared stays pure and reusable.`);
        }
        if (toInfo.layer === "platform" && !ALLOWED_SHARED_PLATFORM_IMPORTS.has(sharedAllowKey)) {
          failures.push(
            `${fromRel} must not import ${toRel}; shared must not depend on platform internals.`,
          );
        }
      }

      if (
        fromInfo.layer === "platform" &&
        ["app-shell", "features", "shared"].includes(toInfo.layer)
      ) {
        failures.push(`${fromRel} must not import ${toRel}; platform stays infrastructure-only.`);
      }

      if (fromInfo.layer === "data" && ["app-shell", "features"].includes(toInfo.layer)) {
        failures.push(
          `${fromRel} must not import ${toRel}; data must stay below app-shell and feature layers.`,
        );
      }

      if (
        fromInfo.layer === "app-shell" &&
        toInfo.layer === "features" &&
        !isFeatureImportContract(toRel)
      ) {
        failures.push(`${fromRel} must import ${toRel} through the feature public entrypoint.`);
      }

      if (
        fromInfo.layer === "features" &&
        fromInfo.zone === "ui" &&
        (toInfo.layer === "platform" || toInfo.layer === "data")
      ) {
        failures.push(
          `${fromRel} must not import ${toRel}; feature ui cannot reach raw platform/data internals.`,
        );
      }

      if (
        fromInfo.layer === "features" &&
        fromInfo.zone === "application" &&
        toInfo.layer === "app-shell"
      ) {
        failures.push(
          `${fromRel} must not import ${toRel}; feature application must stay shell-agnostic.`,
        );
      }

      if (
        !isTestFile(filePath) &&
        fromInfo.layer === "features" &&
        fromInfo.feature === "content-cards" &&
        fromInfo.zone === "ui" &&
        toInfo.layer === "app-shell"
      ) {
        failures.push(
          `${fromRel} must not import ${toRel}; reusable content ui must stay shell-agnostic.`,
        );
      }

      if (
        fromInfo.layer === "features" &&
        fromInfo.zone === "domain" &&
        ["app-shell", "platform", "data"].includes(toInfo.layer)
      ) {
        failures.push(`${fromRel} must not import ${toRel}; feature domain must stay pure.`);
      }

      if (
        fromInfo.layer === "features" &&
        toInfo.layer === "features" &&
        fromInfo.feature !== toInfo.feature &&
        !isFeatureImportContract(toRel)
      ) {
        failures.push(
          `${fromRel} must not import ${toRel}; cross-feature access must go through the other feature public API.`,
        );
      }

      if (
        fromInfo.layer === "features" &&
        toInfo.layer === "features" &&
        fromInfo.feature === toInfo.feature &&
        !isSameFeatureRootPublicEntry(fromInfo, fromRel) &&
        isSameFeatureRootPublicEntry(fromInfo, toRel)
      ) {
        failures.push(
          `${fromRel} must not self-import its feature root barrel (${toRel}); use concrete modules instead.`,
        );
      }
    }
  }

  const indexByNode = new Map();
  const lowLinkByNode = new Map();
  const stack = [];
  const stackSet = new Set();
  const circularGroups = [];
  let nextIndex = 0;

  function visit(node) {
    indexByNode.set(node, nextIndex);
    lowLinkByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    stackSet.add(node);

    for (const dep of graph.get(node) || []) {
      if (!graph.has(dep)) continue;
      if (!indexByNode.has(dep)) {
        visit(dep);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), lowLinkByNode.get(dep)));
        continue;
      }
      if (stackSet.has(dep)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), indexByNode.get(dep)));
      }
    }

    if (lowLinkByNode.get(node) !== indexByNode.get(node)) return;

    const component = [];
    while (stack.length > 0) {
      const member = stack.pop();
      stackSet.delete(member);
      component.push(member);
      if (member === node) break;
    }

    if (component.length > 1) {
      circularGroups.push(component.map((member) => repoRelative(member)).sort());
    }
  }

  for (const filePath of graph.keys()) {
    if (indexByNode.has(filePath)) continue;
    visit(filePath);
  }

  for (const group of circularGroups.sort((left, right) =>
    left.join("|").localeCompare(right.join("|")),
  )) {
    failures.push(`Circular dependency detected: ${group.join(" -> ")}`);
  }
}

function scanStaleReferences(failures) {
  const files = collectFilesFromRoots([
    path.join(ROOT, "AGENTS.md"),
    path.join(ROOT, "OPTIMIZATIONS.md"),
    path.join(ROOT, "docs"),
    path.join(ROOT, "src", "mobile", "ARCHITECTURE.md"),
    path.join(ROOT, "jest.config.js"),
    path.join(ROOT, "metro.config.js"),
    path.join(ROOT, "tsconfig.json"),
    path.join(ROOT, "utils", "guards"),
  ]).filter((filePath) => filePath !== __filename);

  for (const filePath of files) {
    const ext = path.extname(filePath);
    if (![".md", ".js", ".cjs", ".mjs", ".json", ".ts", ".tsx"].includes(ext)) continue;
    const source = read(filePath);
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lowerLine = line.toLowerCase();
      for (const pattern of STALE_REFERENCE_PATTERNS) {
        if (!lowerLine.includes(pattern.toLowerCase())) continue;
        const context = lines
          .slice(Math.max(0, index - 10), index + 1)
          .join(" ")
          .toLowerCase();
        const allowed = STALE_REFERENCE_ALLOW_CONTEXTS.some((hint) => context.includes(hint));
        if (!allowed) {
          failures.push(
            `${repoRelative(filePath)}:${index + 1} still references removed architecture path "${pattern}".`,
          );
        }
      }
    }
  }
}

function scanTsConfig(failures) {
  if (!exists(TSCONFIG_PATH)) return;
  const parsed = JSON.parse(read(TSCONFIG_PATH));
  const paths = parsed?.compilerOptions?.paths;
  if (paths && Object.keys(paths).length > 0) {
    failures.push(
      "tsconfig.json must not define dead path aliases; keep aliases empty unless they are real and used.",
    );
  }
}

function scanFeatureVocabulary(failures) {
  if (!exists(FEATURE_ROOT)) return;
  const features = fs.readdirSync(FEATURE_ROOT, { withFileTypes: true });
  for (const featureEntry of features) {
    if (!featureEntry.isDirectory()) continue;
    const featureDir = path.join(FEATURE_ROOT, featureEntry.name);
    for (const bannedName of ["logic", "state", "runtime"]) {
      const bannedPath = path.join(featureDir, bannedName);
      if (exists(bannedPath)) {
        failures.push(
          `${repoRelative(bannedPath)} must not exist; use ui/application/domain/data/navigation vocabulary.`,
        );
      }
    }
  }
}

function scanFeatureBarrels(failures) {
  if (!exists(FEATURE_ROOT)) return;
  const featureIndexFiles = listFiles(FEATURE_ROOT).filter((filePath) => {
    const baseName = path.basename(filePath);
    return (
      (baseName === "index.ts" || baseName === "index.tsx") &&
      SOURCE_EXTENSIONS.has(path.extname(filePath))
    );
  });

  for (const filePath of featureIndexFiles) {
    const relPath = repoRelative(filePath);
    const source = read(filePath);
    if (/^\s*export\s+\*\s+from\s+/m.test(source)) {
      failures.push(
        `${relPath} must not use wildcard re-exports; keep feature module contracts explicit.`,
      );
    }

    if (relPath.includes("/public/index.")) {
      failures.push(
        `${relPath} must not exist; feature public APIs use explicit public/* contracts instead of broad public/index barrels.`,
      );
    }

    if (!relPath.includes("/domain/index.")) continue;
    const featureDir = path.dirname(path.dirname(filePath));
    const applicationIndex = path.join(featureDir, "application", "index.ts");
    if (!exists(applicationIndex) && !exists(path.join(featureDir, "application", "index.tsx")))
      continue;
    if (
      /^\s*export\s+.*from\s+"\.\/use[^"]+"/m.test(source) ||
      /^\s*export\s+.*from\s+"\.\/use[^"]+"/m.test(source.replace(/'/g, '"'))
    ) {
      failures.push(
        `${relPath} must keep orchestration hooks out of domain once the feature owns an application layer.`,
      );
    }
    if (
      /\bcompleteRegistrationFlow\b/.test(source) ||
      /\bnotificationsRequestState\b/.test(source)
    ) {
      failures.push(`${relPath} must not re-export application orchestration helpers.`);
    }
  }
}

function scanHotPathFileSizes(failures) {
  for (const relativePath of hotPathFiles) {
    const fullPath = path.join(ROOT, relativePath);
    if (!exists(fullPath)) {
      failures.push(`${relativePath} must exist so hot-path architecture stays explicit.`);
      continue;
    }
    const lineCount = read(fullPath).split(/\r?\n/).length;
    if (lineCount > HOT_PATH_FILE_LINE_LIMIT) {
      failures.push(
        `${relativePath} exceeds the hot-path limit (${lineCount}/${HOT_PATH_FILE_LINE_LIMIT} lines). Split orchestration into smaller hooks.`,
      );
    }
  }
}

const failures = [];

const appRootSource = read(APP_ROOT_PATH);
const rootNavigationScreensSource = read(ROOT_NAVIGATION_SCREENS_PATH);
const authNavigatorSource = read(AUTH_NAVIGATOR_PATH);
const mainTabsNavigatorSource = read(MAIN_TABS_NAVIGATOR_PATH);
const mediaViewerSource = read(MEDIA_VIEWER_PATH);
const videoThumbnailCacheSource = read(VIDEO_THUMBNAIL_CACHE_PATH);
const downloadMediaSource = read(DOWNLOAD_MEDIA_PATH);

if (/from\s+["'][^"']*features\/.*\/public\/screens["']/.test(rootNavigationScreensSource)) {
  failures.push(
    "rootNavigationScreens.tsx must lazy-load feature screens with getComponent to protect cold start.",
  );
}

if (/from\s+["'][^"']*features\/auth\/public\/screens["']/.test(authNavigatorSource)) {
  failures.push("AuthNavigator.tsx must not eagerly evaluate every auth screen on cold start.");
}

if (
  /from\s+["'][^"']*(?:SearchStackNavigator|ProfileStackNavigator)["']/.test(
    mainTabsNavigatorSource,
  )
) {
  failures.push("MainTabsNavigator.tsx must lazy-load non-initial tab stacks with getComponent.");
}

if (/import\s+VideoCameraCaptureHost\s+from/.test(appRootSource)) {
  failures.push("App.tsx must keep expo-camera outside the first-render dependency graph.");
}

if (/from\s+["']\.\/MediaVideo["']/.test(mediaViewerSource)) {
  failures.push("MediaViewerModal.tsx must load the native video player only for visible video.");
}

if (
  /import\s*\{[^}]*\bcreateVideoPlayer\b[^}]*\}\s*from\s*["']expo-video["']/.test(
    videoThumbnailCacheSource,
  )
) {
  failures.push("videoThumbnailCache.ts must lazy-load the expo-video player fallback.");
}

if (/from\s+["']expo-(?:file-system\/legacy|media-library)["']/.test(downloadMediaSource)) {
  failures.push("downloadMediaToGallery.ts must load native save modules only on user intent.");
}

const indexSource = read(SERVER_INDEX_PATH);
const registrySource = read(SERVER_REGISTRY_PATH);
const runtimeSource = read(SERVER_RUNTIME_PATH);
const mobileSocialPath = path.join(ROOT, "src", "mobile", "app", "data", "social", "index.ts");
const mobileSocialFollowPath = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "data",
  "social",
  "social.follow.ts",
);
const mobileSocialBlockPath = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "data",
  "social",
  "social.block.ts",
);
const mobileSocialSource = read(mobileSocialPath);
const mobileSocialFollowSource = read(mobileSocialFollowPath);
const mobileSocialBlockSource = read(mobileSocialBlockPath);

if (
  /from "\.\/routes\/follows\.ts"/.test(indexSource) ||
  /from "\.\/routes\/social\.ts"/.test(indexSource)
) {
  failures.push(
    "supabase/functions/server/index.ts must not import compat route handlers directly.",
  );
}

if (
  /registerFollowRoutes\s*\(/.test(indexSource) ||
  /registerSocialRoutes\s*\(/.test(indexSource)
) {
  failures.push("supabase/functions/server/index.ts must not mount compat routes directly.");
}

if (!/registerPrimaryRoutes\(app,\s*routeDeps\)/.test(indexSource)) {
  failures.push(
    "supabase/functions/server/index.ts must register primary routes via routeRegistry.",
  );
}

if (!/registerRollbackCompatRoutes\(app,\s*routeDeps\)/.test(indexSource)) {
  failures.push(
    "supabase/functions/server/index.ts must mount compat routes only through registerRollbackCompatRoutes.",
  );
}

if (!/export const COMPAT_ROUTES_ENABLED/.test(runtimeSource)) {
  failures.push("supabase/functions/server/runtime.ts must define COMPAT_ROUTES_ENABLED.");
}

if (
  !/COMPAT_ROUTES_ENABLED/.test(registrySource) ||
  !/registerFollowRoutes\(app,\s*deps\)/.test(registrySource) ||
  !/registerSocialRoutes\(app,\s*deps\)/.test(registrySource)
) {
  failures.push(
    "supabase/functions/server/routeRegistry.ts must gate compat route registration behind COMPAT_ROUTES_ENABLED.",
  );
}

if (
  !/from "\.\/social\.helpers"/.test(mobileSocialSource) &&
  !/from "\.\/social\.helpers"/.test(mobileSocialFollowSource) &&
  !/from "\.\/social\.helpers"/.test(mobileSocialBlockSource)
) {
  failures.push("src/mobile/app/data/social/*.ts must consume the shared social helper layer.");
}

const legacySharedFiles = listFiles(LEGACY_SHARED_PATH);
if (legacySharedFiles.length > 0) {
  failures.push(
    "src/shared must not contain source files; mobile shared code should live under src/mobile/app.",
  );
}

for (const relativePath of requiredFeaturePublicContracts) {
  if (!exists(path.join(ROOT, relativePath))) {
    failures.push(`${relativePath} must exist as an explicit feature public contract.`);
  }
}

for (const relativePath of requiredFeaturePublicContracts) {
  const fullPath = path.join(ROOT, relativePath);
  if (!exists(fullPath)) continue;
  if (/^\s*export\s+\*\s+from\s+/m.test(read(fullPath))) {
    failures.push(
      `${relativePath} must not use wildcard re-exports; keep feature public APIs explicit.`,
    );
  }
}

if (exists(path.join(ROOT, "src", "mobile", "app", "features", "content-cards", "index.ts"))) {
  failures.push(
    "src/mobile/app/features/content-cards/index.ts must not exist; cross-feature content-card access goes through features/content-cards/public/*.",
  );
}

for (const relativePath of requiredShellModules) {
  if (!exists(path.join(ROOT, relativePath))) {
    failures.push(`${relativePath} must exist to keep the app shell modularized.`);
  }
}

for (const relativePath of requiredFeatureModules) {
  if (!exists(path.join(ROOT, relativePath))) {
    failures.push(`${relativePath} must exist to keep the feature vocabulary explicit.`);
  }
}

for (const relativePath of forbiddenMigrationPaths) {
  if (exists(path.join(ROOT, relativePath))) {
    failures.push(
      `${relativePath} must not exist after the architecture migration hardening pass.`,
    );
  }
}

for (const relativePath of forbiddenSupabaseWorkingTreePaths) {
  if (exists(path.join(ROOT, relativePath))) {
    failures.push(
      `${relativePath} must not exist; keep a single active Supabase migration chain in supabase/migrations.`,
    );
  }
}

if (exists(path.join(ROOT, "src", "mobile", "app", "platform", "api", "index.ts"))) {
  failures.push(
    "src/mobile/app/platform/api/index.ts must not exist; platform API barrels must stay transport-only.",
  );
}

for (const relativePath of forbiddenLegacyScreenHooks) {
  if (exists(path.join(ROOT, relativePath))) {
    failures.push(
      `${relativePath} must not exist; feature orchestration hooks belong under ui or domain.`,
    );
  }
}

scanFeatureVocabulary(failures);
scanFeatureBarrels(failures);
scanHotPathFileSizes(failures);
scanTsConfig(failures);
scanStaleReferences(failures);

const featureFiles = listFiles(FEATURE_ROOT);
for (const filePath of featureFiles) {
  const relativePath = repoRelative(filePath);
  if (!relativePath.startsWith("src/mobile/app/features/content-cards/")) continue;
  if (/shared\/media\/mediaPicker["']/.test(read(filePath))) {
    failures.push(
      `${relativePath} must import pure media detection from mediaVideoUtils to protect startup.`,
    );
  }
}
const forbiddenScreenUtilityFiles = featureFiles.filter((filePath) => {
  if (!filePath.includes(`${path.sep}screens${path.sep}`)) return false;
  if (path.extname(filePath) !== ".ts") return false;
  const baseName = path.basename(filePath);
  return baseName !== "index.ts" && !baseName.endsWith(".test.ts");
});

for (const filePath of forbiddenScreenUtilityFiles) {
  failures.push(
    `${repoRelative(filePath)} must move out of screens/ into ui, application, domain, or data.`,
  );
}

const importScanFiles = listFiles(MOBILE_APP_ROOT).filter((filePath) => {
  if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) return false;
  return !isTestFile(filePath);
});
scanImports(importScanFiles, failures);

if (failures.length > 0) {
  console.error("[architecture-boundaries] FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[architecture-boundaries] OK: layer boundaries, drift protection, feature vocabulary, and server route boundaries are enforced.",
);

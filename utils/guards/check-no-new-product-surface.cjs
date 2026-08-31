const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "../..");
const SNAPSHOT_RELATIVE_PATH = "quality/feature-surface.snapshot.json";
const INTERNAL_TABLE_PATTERNS = [
  /^public\.(?:audit|delivery|dlq|internal|ops|ota|outbox|queue|release|security|telemetry)_[a-z0-9_]+$/,
  /^public\.[a-z0-9_]+_(?:audit|audits|deliveries|delivery|dlq|metrics|nonce|nonces|outbox|queue|queues|receipt|receipts|telemetry)$/,
];
const INTERNAL_HTTP_ROUTE_PATTERNS = [
  /^(?:DELETE|GET|PATCH|POST|PUT) \/make-server-e3557d40\/(?:internal|ops)(?:\/|$)/,
];
const EXISTING_DOMAIN_RPC_PATTERN =
  /^(?:album|app|auth|block|event|follow|media|notification|profile|relationship|report|upload|viewer)_[a-z0-9_]+$/;
const TECHNICAL_EXPO_PLUGIN_ADDITIONS = new Set([
  "@sentry/react-native/expo",
  "expo-asset",
  "expo-build-properties",
  "expo-updates",
]);

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function listFiles(rootDir, relativeDirectory, predicate = () => true) {
  const start = path.join(rootDir, relativeDirectory);
  if (!fs.existsSync(start)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (predicate(absolutePath)) {
        files.push(absolutePath);
      }
    }
  };
  visit(start);
  return files.sort((left, right) => compareStrings(normalizePath(left), normalizePath(right)));
}

function sortedUnique(values) {
  return [...new Set(values.map((value) => String(value)))].sort(compareStrings);
}

function digest(values) {
  return crypto.createHash("sha256").update(sortedUnique(values).join("\n")).digest("hex");
}

function findDeclarationValueStart(source, kind, declarationName) {
  const declarationPattern =
    kind === "type"
      ? /(?:export\s+)?type\s+([A-Za-z][A-Za-z0-9_]*)\s*=/gm
      : /(?:export\s+)?const\s+([A-Za-z][A-Za-z0-9_]*)\s*=/gm;
  for (const match of source.matchAll(declarationPattern)) {
    if (match[1] === declarationName) {
      return match.index + match[0].length;
    }
  }
  throw new Error(`Unable to find ${kind} declaration ${declarationName}.`);
}

function findTypeBody(source, typeName) {
  const valueStart = findDeclarationValueStart(source, "type", typeName);
  const openingIndex = source.indexOf("{", valueStart);
  if (openingIndex < 0) {
    throw new Error(`Unable to find opening brace for object type ${typeName}.`);
  }
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character !== "}") continue;
    depth -= 1;
    if (depth === 0) {
      return source.slice(openingIndex + 1, index);
    }
  }
  throw new Error(`Unable to find closing brace for object type ${typeName}.`);
}

function extractObjectTypeKeys(source, typeName) {
  const body = findTypeBody(source, typeName);
  return sortedUnique(
    [...body.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((match) => match[1]),
  );
}

function extractStringUnion(source, typeName) {
  const valueStart = findDeclarationValueStart(source, "type", typeName);
  const closingIndex = source.indexOf(";", valueStart);
  if (closingIndex < 0) {
    throw new Error(`Unable to find closing semicolon for string union ${typeName}.`);
  }
  const body = source.slice(valueStart, closingIndex);
  return sortedUnique([...body.matchAll(/["']([^"']+)["']/g)].map((item) => item[1]));
}

function extractQuotedStrings(source) {
  const values = [];
  for (let index = 0; index < source.length; index += 1) {
    const quote = source[index];
    if (quote !== '"' && quote !== "'") continue;
    let value = "";
    for (index += 1; index < source.length; index += 1) {
      const character = source[index];
      if (character === "\\" && index + 1 < source.length) {
        value += character + source[index + 1];
        index += 1;
        continue;
      }
      if (character === quote) break;
      value += character;
    }
    values.push(value);
  }
  return values;
}

function extractStringArray(source, constantName) {
  const valueStart = findDeclarationValueStart(source, "const", constantName);
  const openingIndex = source.indexOf("[", valueStart);
  if (openingIndex < 0) {
    throw new Error(`Unable to find opening bracket for catalog array ${constantName}.`);
  }
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") depth += 1;
    if (character !== "]") continue;
    depth -= 1;
    if (depth === 0) {
      return sortedUnique(extractQuotedStrings(source.slice(openingIndex + 1, index)));
    }
  }
  throw new Error(`Unable to find closing bracket for catalog array ${constantName}.`);
}

function fingerprintValues(values) {
  const uniqueValues = sortedUnique(values);
  return {
    valueCount: uniqueValues.length,
    valueSha256: digest(uniqueValues),
  };
}

function collectScreenEntrypoints(rootDir) {
  const publicScreenFiles = listFiles(rootDir, "src/mobile/app/features", (file) =>
    normalizePath(file).endsWith("/public/screens.ts"),
  );
  const entries = [];
  for (const absolutePath of publicScreenFiles) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(
      /export\s*\{\s*([A-Z][A-Za-z0-9_]*Screen)\s*\}\s*from\s*["']([^"']+)["']/g,
    )) {
      const publicPath = normalizePath(path.relative(rootDir, absolutePath));
      const sourcePath = normalizePath(
        path.relative(rootDir, path.resolve(path.dirname(absolutePath), `${match[2]}.tsx`)),
      );
      entries.push(`${match[1]}|${publicPath}|${sourcePath}`);
    }
  }
  return sortedUnique(entries);
}

const MODAL_SURFACE_TAGS = [
  "AppModalHost",
  "AppModalSheet",
  "DangerConfirmSheet",
  "EventCardUserListModal",
  "ImageViewerModal",
  "MediaLibraryPickerSheet",
  "MediaSourceSheet",
  "MediaViewerModal",
  "OverflowActionMenu",
  "UserListSheet",
  "VideoCameraCaptureHost",
];

function collectModalSurfaceMounts(rootDir) {
  const tagPattern = new RegExp(`<(${MODAL_SURFACE_TAGS.join("|")})\\b`, "g");
  const entries = [];
  const files = listFiles(
    rootDir,
    "src/mobile/app",
    (file) => file.endsWith(".tsx") && !file.includes(".test."),
  );
  for (const absolutePath of files) {
    const source = fs.readFileSync(absolutePath, "utf8");
    const counts = new Map();
    for (const match of source.matchAll(tagPattern)) {
      counts.set(match[1], (counts.get(match[1]) || 0) + 1);
    }
    if (counts.size === 0) continue;
    const mountSummary = [...counts]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([tag, count]) => `${tag}:${count}`)
      .join(",");
    entries.push(`${normalizePath(path.relative(rootDir, absolutePath))}|${mountSummary}`);
  }
  return sortedUnique(entries);
}

function collectDeepLinks(rootDir) {
  const source = readText(rootDir, "src/mobile/app/app-shell/navigation/rootNavigation.linking.ts");
  const screenBlock = source.match(/screens\s*:\s*\{([\s\S]*?)\n\s*\}/m)?.[1] || "";
  return sortedUnique(
    [...screenBlock.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*["']([^"']+)["']/gm)].map(
      (match) => `${match[1]}:${match[2]}`,
    ),
  );
}

function collectAndroidManifestSurface(rootDir) {
  const source = readText(rootDir, "android/app/src/main/AndroidManifest.xml");
  const permissions = [
    ...source.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"[^>]*\/>/g),
  ].map((match) => match[1]);
  const features = [...source.matchAll(/<uses-feature\b[^>]*android:name="([^"]+)"[^>]*\/>/g)].map(
    (match) => match[1],
  );
  const intentSchemes = [...source.matchAll(/<data\b[^>]*android:scheme="([^"]+)"[^>]*\/>/g)].map(
    (match) => match[1],
  );
  return {
    features: sortedUnique(features),
    intentSchemes: sortedUnique(intentSchemes),
    permissions: sortedUnique(permissions),
    supportsPictureInPicture: /android:supportsPictureInPicture="true"/.test(source),
  };
}

function collectIosPrebuildSurface(rootDir) {
  const config = JSON.parse(readText(rootDir, "config/ios-prebuild.json"));
  const appConfigSource = readText(rootDir, "app.config.js");
  const plugins = [];
  const pluginPermissionConfigKeys = [];
  for (const rawPlugin of config.plugins || []) {
    const pluginId = Array.isArray(rawPlugin) ? rawPlugin[0] : rawPlugin;
    plugins.push(String(pluginId));
    if (!Array.isArray(rawPlugin) || !rawPlugin[1] || typeof rawPlugin[1] !== "object") continue;
    for (const key of Object.keys(rawPlugin[1])) {
      if (/permission$/i.test(key)) {
        pluginPermissionConfigKeys.push(`${pluginId}.${key}`);
      }
    }
  }
  for (const match of appConfigSource.matchAll(
    /plugins\s*:\s*\[\s*\.\.\.iosPrebuild\.plugins\s*,\s*["']([^"']+)["']/g,
  )) {
    plugins.push(match[1]);
  }
  const infoPlist = config.ios?.infoPlist || {};
  const entitlements = config.ios?.entitlements || {};
  return {
    entitlementKeys: sortedUnique(Object.keys(entitlements)),
    pluginIds: sortedUnique(plugins),
    pluginPermissionConfigKeys: sortedUnique(pluginPermissionConfigKeys),
    scheme: String(config.scheme || ""),
    usageDescriptionKeys: sortedUnique(
      Object.keys(infoPlist).filter((key) => /UsageDescription$/.test(key)),
    ),
  };
}

function collectNotificationSurface(rootDir) {
  const apiContracts = readText(rootDir, "src/mobile/app/data/contracts/api.ts");
  const presentation = readText(
    rootDir,
    "src/mobile/app/features/notifications/application/notificationsPresentation.ts",
  );
  const notificationFiles = listFiles(
    rootDir,
    "src/mobile/app",
    (file) => /\.(?:ts|tsx)$/.test(file) && !file.includes(".test."),
  );
  const channelIds = [];
  const categoryIds = [];
  for (const absolutePath of notificationFiles) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(/\b[A-Z][A-Z0-9_]*CHANNEL_ID\s*=\s*["']([^"']+)["']/g)) {
      channelIds.push(match[1]);
    }
    for (const match of source.matchAll(/setNotificationChannelAsync\(\s*["']([^"']+)["']/g)) {
      channelIds.push(match[1]);
    }
    for (const match of source.matchAll(/setNotificationCategoryAsync\(\s*["']([^"']+)["']/g)) {
      categoryIds.push(match[1]);
    }
  }
  return {
    androidChannelIds: sortedUnique(channelIds),
    categoryIds: sortedUnique(categoryIds),
    filterCategories: extractStringUnion(presentation, "FilterCategory"),
    postgresTypes: collectPostgresNotificationTypes(rootDir),
    types: extractStringUnion(apiContracts, "NotificationType"),
  };
}

function collectPostgresNotificationTypes(rootDir) {
  const values = [];
  for (const absolutePath of listFiles(rootDir, "supabase/migrations", (file) =>
    file.endsWith(".sql"),
  )) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(
      /create\s+type\s+(?:public\.)?notification_type\s+as\s+enum\s*\(([\s\S]*?)\)\s*;/gi,
    )) {
      values.push(...extractQuotedStrings(match[1]));
    }
    for (const match of source.matchAll(
      /alter\s+type\s+(?:public\.)?notification_type\s+add\s+value(?:\s+if\s+not\s+exists)?\s*["']([^"']+)["']/gi,
    )) {
      values.push(match[1]);
    }
  }
  return sortedUnique(values);
}

function collectSettingsSurface(rootDir) {
  const source = readText(
    rootDir,
    "src/mobile/app/features/settings/ui/screens/settingsScreen.shared.tsx",
  );
  const itemKeys = [...source.matchAll(/\bkey\s*:\s*["']([^"']+)["']/g)].map((match) => match[1]);
  const groupKeyUnion = source.match(
    /export\s+interface\s+SettingsSectionData\s*\{[\s\S]*?\bkey\s*:\s*([^;]+);/m,
  );
  const privacySource = readText(
    rootDir,
    "src/mobile/app/features/settings/ui/screens/PrivacySettingsScreen.tsx",
  );
  return {
    actionKeys: extractStringUnion(source, "SettingsActionKey"),
    groupKeys: groupKeyUnion
      ? sortedUnique([...groupKeyUnion[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]))
      : [],
    itemKeys: sortedUnique(itemKeys.filter((key) => !["account", "other"].includes(key))),
    privacyToggleCount: [...privacySource.matchAll(/<PrivacySettingsToggleCard\b/g)].length,
  };
}

function collectHttpRoutes(rootDir) {
  const routes = [];
  for (const absolutePath of listFiles(rootDir, "supabase/functions/server", (file) =>
    file.endsWith(".ts"),
  )) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(
      /\bapp\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
    )) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  return sortedUnique(routes);
}

function collectMobileDataContracts(rootDir) {
  const rpcNames = [];
  const directRelations = [];
  const functionNames = [];
  for (const absolutePath of listFiles(
    rootDir,
    "src/mobile/app",
    (file) => /\.(?:ts|tsx)$/.test(file) && !file.includes(".test."),
  )) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)) {
      rpcNames.push(match[1]);
    }
    for (const match of source.matchAll(/\.from\(\s*["']([^"']+)["']/g)) {
      directRelations.push(match[1]);
    }
    for (const match of source.matchAll(/functions\s*\.invoke\(\s*["']([^"']+)["']/g)) {
      functionNames.push(match[1]);
    }
  }
  return {
    directRelations: sortedUnique(directRelations),
    edgeFunctionNames: sortedUnique(["server", ...functionNames]),
    rpcNames: sortedUnique(rpcNames),
  };
}

function collectDatabaseTables(rootDir) {
  const tables = [];
  for (const absolutePath of listFiles(rootDir, "supabase/migrations", (file) =>
    file.endsWith(".sql"),
  )) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(
      /\bcreate\s+table(?:\s+if\s+not\s+exists)?\s+(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)/gi,
    )) {
      tables.push(`${match[1] || "public"}.${match[2]}`.toLowerCase());
    }
  }
  return sortedUnique(tables);
}

function collectStorageBuckets(rootDir) {
  const buckets = [];
  for (const absolutePath of listFiles(rootDir, "supabase/migrations", (file) =>
    file.endsWith(".sql"),
  )) {
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(
      /insert\s+into\s+storage\.buckets\s*\([^)]*\)\s*values\s*\(\s*["']([^"']+)["']/gi,
    )) {
      buckets.push(match[1]);
    }
  }
  for (const relativeDirectory of ["src/mobile/app", "supabase/functions/server"]) {
    for (const absolutePath of listFiles(
      rootDir,
      relativeDirectory,
      (file) => /\.(?:ts|tsx)$/.test(file) && !file.includes(".test."),
    )) {
      const source = fs.readFileSync(absolutePath, "utf8");
      for (const match of source.matchAll(
        /\b(?:MANAGED_)?(?:MEDIA_|STORAGE_)?BUCKET\s*=\s*["']([^"']+)["']/g,
      )) {
        buckets.push(match[1]);
      }
    }
  }
  return sortedUnique(buckets);
}

function collectCopyFingerprint(rootDir) {
  const messageKeys = [];
  for (const relativePath of [
    "src/mobile/app/shared/i18n/locales/tr.ts",
    "src/mobile/app/shared/i18n/locales/tr.extra.ts",
  ]) {
    const source = readText(rootDir, relativePath);
    for (const match of source.matchAll(/^\s*["']([^"']+)["']\s*:/gm)) {
      messageKeys.push(match[1]);
    }
  }
  const keys = sortedUnique(messageKeys);
  return {
    keyCount: keys.length,
    keySha256: digest(keys),
    namespaces: sortedUnique(keys.map((key) => key.split(".")[0])),
  };
}

function collectCatalogFingerprints(rootDir) {
  const categoriesSource = readText(rootDir, "src/mobile/app/shared/catalog/categories.ts");
  const taxonomySource = readText(rootDir, "src/mobile/app/shared/catalog/taxonomy.ts");
  const institutionsSource = readText(
    rootDir,
    "src/mobile/app/shared/catalog/universities.institutions.ts",
  );
  const departmentsSource = readText(
    rootDir,
    "src/mobile/app/shared/catalog/universities.departments.ts",
  );
  const extraDepartmentsSource = readText(
    rootDir,
    "src/mobile/app/shared/catalog/universities.departments.extra.ts",
  );
  const profileTaxonomySource = readText(
    rootDir,
    "src/mobile/app/shared/catalog/universities.taxonomyData.ts",
  );
  return {
    categories: fingerprintValues(extractStringArray(categoriesSource, "CATEGORY_OPTIONS")),
    clubCategories: fingerprintValues(
      extractStringArray(profileTaxonomySource, "CLUB_CATEGORY_OPTIONS"),
    ),
    departments: fingerprintValues([
      ...extractStringArray(departmentsSource, "DEPARTMENT_OPTIONS_PRIMARY"),
      ...extractStringArray(extraDepartmentsSource, "DEPARTMENT_OPTIONS_EXTRA"),
    ]),
    eventTypes: fingerprintValues(extractStringArray(taxonomySource, "eventTypes")),
    gradeYears: fingerprintValues(extractStringArray(profileTaxonomySource, "GRADE_YEAR_OPTIONS")),
    interests: fingerprintValues(extractStringArray(profileTaxonomySource, "INTEREST_OPTIONS")),
    universities: fingerprintValues(extractStringArray(institutionsSource, "UNIVERSITY_OPTIONS")),
  };
}

function collectForbiddenProductPanelHits(rootDir) {
  const hits = [];
  const pathPattern =
    /(?:^|\/)(?:admin|moderator|organizer)(?:[-_/](?:panel|portal|dashboard))?(?:\/|\.|$)/i;
  const symbolPattern =
    /\b(?:Admin|Moderator|Organizer)[A-Za-z0-9]*(?:Panel|Portal|Dashboard|Screen)\b/;
  for (const absolutePath of listFiles(
    rootDir,
    "src",
    (file) => /\.(?:js|jsx|ts|tsx)$/.test(file) && !file.includes(".test."),
  )) {
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    const source = fs.readFileSync(absolutePath, "utf8");
    if (pathPattern.test(relativePath)) hits.push(`${relativePath}:path`);
    for (const match of source.matchAll(new RegExp(symbolPattern.source, "g"))) {
      hits.push(`${relativePath}:symbol:${match[0]}`);
    }
  }
  return sortedUnique(hits);
}

function collectTaxonomySurface(rootDir) {
  const apiContracts = readText(rootDir, "src/mobile/app/data/contracts/api.ts");
  const homeUiState = readText(
    rootDir,
    "src/mobile/app/features/home/application/useHomeScreenUiState.ts",
  );
  const searchTypes = readText(rootDir, "src/mobile/app/features/search/domain/types.ts");
  const reportTargets = apiContracts.match(
    /export\s+interface\s+ReportPayload\s*\{[\s\S]*?targetType\s*:\s*([\s\S]*?);/m,
  );
  return {
    accountTypes: extractStringUnion(apiContracts, "AccountType"),
    eventVisibilities: extractStringUnion(apiContracts, "EventVisibility"),
    homeAccountFilters: extractStringUnion(homeUiState, "EntityFilter"),
    homeContentFilters: extractStringUnion(homeUiState, "TypeFilter"),
    homeSortOptions: extractStringUnion(homeUiState, "SortOption"),
    homeSourceFilters: extractStringUnion(homeUiState, "SourceFilter"),
    reportTargetTypes: reportTargets
      ? sortedUnique([...reportTargets[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]))
      : [],
    searchSortOptions: extractStringUnion(searchTypes, "SortOption"),
    searchTypes: extractStringUnion(searchTypes, "SearchType"),
  };
}

function collectFeatureSurface(rootDir = DEFAULT_ROOT) {
  const navigationTypes = readText(rootDir, "src/mobile/app/app-shell/navigation/types.ts");
  const bottomTabs = readText(
    rootDir,
    "src/mobile/app/app-shell/navigation/components/MainBottomTabs.tsx",
  );
  const permissions = readText(rootDir, "src/mobile/app/platform/permissions/devicePermissions.ts");
  const modalMounts = collectModalSurfaceMounts(rootDir);
  const android = collectAndroidManifestSurface(rootDir);
  const ios = collectIosPrebuildSurface(rootDir);
  return {
    api: {
      httpRoutes: collectHttpRoutes(rootDir),
      ...collectMobileDataContracts(rootDir),
    },
    catalog: collectCatalogFingerprints(rootDir),
    copy: collectCopyFingerprint(rootDir),
    database: {
      allTables: collectDatabaseTables(rootDir),
      storageBuckets: collectStorageBuckets(rootDir),
    },
    native: {
      androidFeatures: android.features,
      androidIntentSchemes: android.intentSchemes,
      androidPermissions: android.permissions,
      androidSupportsPictureInPicture: android.supportsPictureInPicture,
      devicePermissionKeys: extractStringUnion(permissions, "DevicePermissionKey"),
      expoPluginIds: ios.pluginIds,
      expoPluginPermissionConfigKeys: ios.pluginPermissionConfigKeys,
      iosEntitlementKeys: ios.entitlementKeys,
      iosScheme: ios.scheme,
      iosUsageDescriptionKeys: ios.usageDescriptionKeys,
    },
    navigation: {
      deepLinks: collectDeepLinks(rootDir),
      modalMountCount: modalMounts.reduce((count, entry) => {
        const mounts = entry.split("|")[1] || "";
        return (
          count +
          mounts
            .split(",")
            .filter(Boolean)
            .reduce((sum, mount) => sum + Number(mount.split(":")[1] || 0), 0)
        );
      }, 0),
      modalMountSha256: digest(modalMounts),
      rootLeafRoutes: extractObjectTypeKeys(navigationTypes, "RootStackParamList"),
      rootNavigatorRoutes: extractObjectTypeKeys(navigationTypes, "RootNavigatorParamList"),
      screenEntrypoints: collectScreenEntrypoints(rootDir),
      tabRouteNames: extractObjectTypeKeys(navigationTypes, "MainTabsParamList"),
      visibleTabKeys: extractStringUnion(bottomTabs, "TabKey"),
    },
    notifications: collectNotificationSurface(rootDir),
    policy: {
      forbiddenProductPanelHits: collectForbiddenProductPanelHits(rootDir),
    },
    settings: collectSettingsSurface(rootDir),
    taxonomy: collectTaxonomySurface(rootDir),
  };
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function formatChange(label, kind, values) {
  return values.map((value) => `${label}: ${kind} ${JSON.stringify(value)}`);
}

function compareExactSet(label, baseline, current, violations, options = {}) {
  const additions = difference(current, baseline);
  const removals = difference(baseline, current);
  const allowedAdditions = additions.filter((value) => options.allowAddition?.(value));
  const blockedAdditions = difference(additions, allowedAdditions);
  violations.push(...formatChange(label, "added", blockedAdditions));
  violations.push(...formatChange(label, "removed", removals));
  return allowedAdditions.map(
    (value) => `${label}: allowed internal addition ${JSON.stringify(value)}`,
  );
}

function compareScalar(label, baseline, current, violations) {
  if (baseline !== current) {
    violations.push(
      `${label}: changed from ${JSON.stringify(baseline)} to ${JSON.stringify(current)}`,
    );
  }
}

function compareFeatureSurface(snapshot, current) {
  const baseline = snapshot.protectedSurface;
  const violations = [];
  const allowed = [];
  const exactSets = [
    [
      "navigation.rootLeafRoutes",
      baseline.navigation.rootLeafRoutes,
      current.navigation.rootLeafRoutes,
    ],
    [
      "navigation.rootNavigatorRoutes",
      baseline.navigation.rootNavigatorRoutes,
      current.navigation.rootNavigatorRoutes,
    ],
    [
      "navigation.screenEntrypoints",
      baseline.navigation.screenEntrypoints,
      current.navigation.screenEntrypoints,
    ],
    [
      "navigation.tabRouteNames",
      baseline.navigation.tabRouteNames,
      current.navigation.tabRouteNames,
    ],
    [
      "navigation.visibleTabKeys",
      baseline.navigation.visibleTabKeys,
      current.navigation.visibleTabKeys,
    ],
    ["navigation.deepLinks", baseline.navigation.deepLinks, current.navigation.deepLinks],
    ["notifications.types", baseline.notifications.types, current.notifications.types],
    [
      "notifications.filterCategories",
      baseline.notifications.filterCategories,
      current.notifications.filterCategories,
    ],
    [
      "notifications.postgresTypes",
      baseline.notifications.postgresTypes,
      current.notifications.postgresTypes,
    ],
    [
      "notifications.androidChannelIds",
      baseline.notifications.androidChannelIds,
      current.notifications.androidChannelIds,
    ],
    [
      "notifications.categoryIds",
      baseline.notifications.categoryIds,
      current.notifications.categoryIds,
    ],
    [
      "native.devicePermissionKeys",
      baseline.native.devicePermissionKeys,
      current.native.devicePermissionKeys,
    ],
    [
      "native.androidPermissions",
      baseline.native.androidPermissions,
      current.native.androidPermissions,
    ],
    ["native.androidFeatures", baseline.native.androidFeatures, current.native.androidFeatures],
    [
      "native.androidIntentSchemes",
      baseline.native.androidIntentSchemes,
      current.native.androidIntentSchemes,
    ],
    [
      "native.expoPluginPermissionConfigKeys",
      baseline.native.expoPluginPermissionConfigKeys,
      current.native.expoPluginPermissionConfigKeys,
    ],
    [
      "native.iosEntitlementKeys",
      baseline.native.iosEntitlementKeys,
      current.native.iosEntitlementKeys,
    ],
    [
      "native.iosUsageDescriptionKeys",
      baseline.native.iosUsageDescriptionKeys,
      current.native.iosUsageDescriptionKeys,
    ],
    ["settings.groupKeys", baseline.settings.groupKeys, current.settings.groupKeys],
    ["settings.itemKeys", baseline.settings.itemKeys, current.settings.itemKeys],
    ["settings.actionKeys", baseline.settings.actionKeys, current.settings.actionKeys],
    ["api.edgeFunctionNames", baseline.api.edgeFunctionNames, current.api.edgeFunctionNames],
    ["database.storageBuckets", baseline.database.storageBuckets, current.database.storageBuckets],
    ["taxonomy.accountTypes", baseline.taxonomy.accountTypes, current.taxonomy.accountTypes],
    [
      "taxonomy.eventVisibilities",
      baseline.taxonomy.eventVisibilities,
      current.taxonomy.eventVisibilities,
    ],
    [
      "taxonomy.homeAccountFilters",
      baseline.taxonomy.homeAccountFilters,
      current.taxonomy.homeAccountFilters,
    ],
    [
      "taxonomy.homeContentFilters",
      baseline.taxonomy.homeContentFilters,
      current.taxonomy.homeContentFilters,
    ],
    [
      "taxonomy.homeSortOptions",
      baseline.taxonomy.homeSortOptions,
      current.taxonomy.homeSortOptions,
    ],
    [
      "taxonomy.homeSourceFilters",
      baseline.taxonomy.homeSourceFilters,
      current.taxonomy.homeSourceFilters,
    ],
    [
      "taxonomy.reportTargetTypes",
      baseline.taxonomy.reportTargetTypes,
      current.taxonomy.reportTargetTypes,
    ],
    [
      "taxonomy.searchSortOptions",
      baseline.taxonomy.searchSortOptions,
      current.taxonomy.searchSortOptions,
    ],
    ["taxonomy.searchTypes", baseline.taxonomy.searchTypes, current.taxonomy.searchTypes],
    [
      "policy.forbiddenProductPanelHits",
      baseline.policy.forbiddenProductPanelHits,
      current.policy.forbiddenProductPanelHits,
    ],
  ];
  for (const [label, expected, actual] of exactSets) {
    allowed.push(...compareExactSet(label, expected, actual, violations));
  }

  allowed.push(
    ...compareExactSet(
      "native.expoPluginIds",
      baseline.native.expoPluginIds,
      current.native.expoPluginIds,
      violations,
      { allowAddition: (value) => TECHNICAL_EXPO_PLUGIN_ADDITIONS.has(value) },
    ),
  );
  allowed.push(
    ...compareExactSet(
      "api.httpRoutes",
      baseline.api.httpRoutes,
      current.api.httpRoutes,
      violations,
      {
        allowAddition: (value) =>
          INTERNAL_HTTP_ROUTE_PATTERNS.some((pattern) => pattern.test(value)),
      },
    ),
  );
  allowed.push(
    ...compareExactSet("api.rpcNames", baseline.api.rpcNames, current.api.rpcNames, violations, {
      allowAddition: (value) => EXISTING_DOMAIN_RPC_PATTERN.test(value),
    }),
  );
  allowed.push(
    ...compareExactSet(
      "api.directRelations",
      baseline.api.directRelations,
      current.api.directRelations,
      violations,
      {
        allowAddition: (value) =>
          INTERNAL_TABLE_PATTERNS.some((pattern) => pattern.test(`public.${value}`)),
      },
    ),
  );
  allowed.push(
    ...compareExactSet(
      "database.allTables",
      baseline.database.allTables,
      current.database.allTables,
      violations,
      { allowAddition: (value) => INTERNAL_TABLE_PATTERNS.some((pattern) => pattern.test(value)) },
    ),
  );

  compareScalar(
    "navigation.modalMountCount",
    baseline.navigation.modalMountCount,
    current.navigation.modalMountCount,
    violations,
  );
  compareScalar(
    "navigation.modalMountSha256",
    baseline.navigation.modalMountSha256,
    current.navigation.modalMountSha256,
    violations,
  );
  compareScalar(
    "native.androidSupportsPictureInPicture",
    baseline.native.androidSupportsPictureInPicture,
    current.native.androidSupportsPictureInPicture,
    violations,
  );
  compareScalar(
    "native.iosScheme",
    baseline.native.iosScheme,
    current.native.iosScheme,
    violations,
  );
  compareScalar(
    "settings.privacyToggleCount",
    baseline.settings.privacyToggleCount,
    current.settings.privacyToggleCount,
    violations,
  );
  compareScalar("copy.keyCount", baseline.copy.keyCount, current.copy.keyCount, violations);
  compareScalar("copy.keySha256", baseline.copy.keySha256, current.copy.keySha256, violations);
  compareExactSet("copy.namespaces", baseline.copy.namespaces, current.copy.namespaces, violations);
  const baselineCatalogGroups = Object.keys(baseline.catalog).sort(compareStrings);
  const currentCatalogGroups = Object.keys(current.catalog).sort(compareStrings);
  compareExactSet("catalog.groups", baselineCatalogGroups, currentCatalogGroups, violations);
  for (const group of baselineCatalogGroups) {
    if (!current.catalog[group]) continue;
    compareScalar(
      `catalog.${group}.valueCount`,
      baseline.catalog[group].valueCount,
      current.catalog[group].valueCount,
      violations,
    );
    compareScalar(
      `catalog.${group}.valueSha256`,
      baseline.catalog[group].valueSha256,
      current.catalog[group].valueSha256,
      violations,
    );
  }

  return { allowed, violations };
}

function summarizeSurface(surface) {
  return [
    `routes=${surface.navigation.rootLeafRoutes.length}`,
    `screens=${surface.navigation.screenEntrypoints.length}`,
    `visibleTabs=${surface.navigation.visibleTabKeys.length}`,
    `notificationTypes=${surface.notifications.types.length}`,
    `devicePermissions=${surface.native.devicePermissionKeys.length}`,
    `settingsGroups=${surface.settings.groupKeys.length}`,
    `settingsItems=${surface.settings.itemKeys.length}`,
    `httpRoutes=${surface.api.httpRoutes.length}`,
    `databaseTables=${surface.database.allTables.length}`,
  ].join(" ");
}

function runCli() {
  const rootDir = DEFAULT_ROOT;
  const current = collectFeatureSurface(rootDir);
  if (process.argv.includes("--print-current")) {
    process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
    return;
  }
  const snapshotPath = path.join(rootDir, SNAPSHOT_RELATIVE_PATH);
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Feature surface snapshot is missing: ${SNAPSHOT_RELATIVE_PATH}`);
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  if (snapshot.schemaVersion !== 1 || !snapshot.protectedSurface) {
    throw new Error("Feature surface snapshot has an unsupported schema.");
  }
  const result = compareFeatureSurface(snapshot, current);
  if (result.violations.length > 0) {
    console.error("[feature-freeze] FAIL: product surface drift detected.");
    result.violations.forEach((violation) => console.error(`- ${violation}`));
    console.error(
      "Update the snapshot only after an explicit product-scope decision and contract review.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[feature-freeze] PASS ${summarizeSurface(current)}`);
  result.allowed.forEach((entry) => console.log(`[feature-freeze] ${entry}`));
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(
      `[feature-freeze] ERROR ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  collectFeatureSurface,
  compareFeatureSurface,
  digest,
  sortedUnique,
};

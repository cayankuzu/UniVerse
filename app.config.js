const fs = require("fs");
const path = require("path");
const appRelease = require("./config/app-release.json");
const iosPrebuild = require("./config/ios-prebuild.json");

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || "development";
const RELEASE_CHANNEL = process.env.EXPO_PUBLIC_RELEASE_CHANNEL || APP_ENV;
const RELEASE_ENVIRONMENTS = new Set(["development", "preview", "production"]);
if (!RELEASE_ENVIRONMENTS.has(APP_ENV)) {
  throw new Error("[app.config] EXPO_PUBLIC_APP_ENV must be development, preview, or production.");
}
if (!RELEASE_ENVIRONMENTS.has(RELEASE_CHANNEL) || RELEASE_CHANNEL !== APP_ENV) {
  throw new Error("[app.config] EXPO_PUBLIC_RELEASE_CHANNEL must match EXPO_PUBLIC_APP_ENV.");
}
const EAS_BUILD_PLATFORM = (process.env.EAS_BUILD_PLATFORM || "").trim().toLowerCase();
const GENERATE_IOS_NATIVE_CONFIG = EAS_BUILD_PLATFORM === "ios";
const APP_SCHEME =
  (process.env.EXPO_PUBLIC_APP_SCHEME || "ogrencisosyalagi").trim() || "ogrencisosyalagi";
if (APP_SCHEME !== iosPrebuild.scheme) {
  throw new Error(
    `[app.config] EXPO_PUBLIC_APP_SCHEME must match config/ios-prebuild.json (${iosPrebuild.scheme}).`,
  );
}
const APP_NAME = (process.env.EXPO_PUBLIC_APP_NAME || "UniVerse").trim() || "UniVerse";
const APP_SLUG = (process.env.EXPO_PUBLIC_EXPO_SLUG || process.env.EXPO_SLUG || "").trim();
const DEFAULT_EXPO_OWNER = "cayanns-team";
const DEFAULT_EXPO_SLUG = "universe";
const DEFAULT_EAS_PROJECT_ID = "c7565eaa-d013-430f-9576-217c4beefa3f";
const ANDROID_PACKAGE = appRelease.android.package;

const configuredAndroidPackage = (process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "").trim();
if (configuredAndroidPackage && configuredAndroidPackage !== ANDROID_PACKAGE) {
  throw new Error(
    `[app.config] EXPO_PUBLIC_ANDROID_PACKAGE must match config/app-release.json (${ANDROID_PACKAGE}).`,
  );
}

function readOptionalPath(names) {
  for (const name of names) {
    const value = (process.env[name] || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function resolveConfigPath(filePath) {
  const normalizedPath = path.normalize(String(filePath || "").trim());
  if (!normalizedPath) {
    throw new Error("[app.config] Empty config file path is not allowed.");
  }
  if (path.isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath === ".." || normalizedPath.startsWith(`..${path.sep}`)) {
    throw new Error(`[app.config] Refusing config file path outside project: ${filePath}`);
  }

  return path.normalize(`${__dirname}${path.sep}${normalizedPath}`);
}

function toExpoRelativePath(filePath) {
  const absolutePath = resolveConfigPath(filePath);
  return `./${path.relative(__dirname, absolutePath).replace(/\\/g, "/")}`;
}

function shouldRequireGoogleServicesFile(platformKey) {
  return APP_ENV === "production" && EAS_BUILD_PLATFORM === platformKey;
}

function resolveGoogleServicesFile({ envNames, fallbackRelativePath, platform, platformKey }) {
  const configuredPath = readOptionalPath(envNames);
  const candidatePath = configuredPath || fallbackRelativePath;
  const absolutePath = resolveConfigPath(candidatePath);

  if (fs.existsSync(absolutePath)) {
    return toExpoRelativePath(absolutePath);
  }

  if (shouldRequireGoogleServicesFile(platformKey)) {
    throw new Error(
      `[app.config] ${platform} Google services config is required for production. ` +
        `Set one of ${envNames.join(", ")} to an injected file-secret path.`,
    );
  }

  return "";
}

module.exports = ({ config }) => {
  const configuredExtra = config.extra || {};
  const configuredEas = configuredExtra.eas || {};
  const easProjectId =
    (
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
      process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ||
      process.env.EAS_PROJECT_ID ||
      configuredEas.projectId ||
      DEFAULT_EAS_PROJECT_ID
    ).trim() || DEFAULT_EAS_PROJECT_ID;
  const expoOwner =
    (
      process.env.EXPO_PUBLIC_EXPO_OWNER ||
      process.env.EXPO_OWNER ||
      config.owner ||
      DEFAULT_EXPO_OWNER
    ).trim() || DEFAULT_EXPO_OWNER;
  const expoSlug = APP_SLUG || config.slug || DEFAULT_EXPO_SLUG;
  const updatesUrl =
    (
      process.env.EXPO_PUBLIC_UPDATES_URL ||
      process.env.EXPO_UPDATES_URL ||
      `https://u.expo.dev/${easProjectId}`
    ).trim() || `https://u.expo.dev/${easProjectId}`;
  const iosConfig = {
    ...(iosPrebuild.ios || {}),
    buildNumber: appRelease.ios.buildNumber,
    bundleIdentifier: appRelease.ios.bundleIdentifier,
  };
  const iosGoogleServicesFile = GENERATE_IOS_NATIVE_CONFIG
    ? resolveGoogleServicesFile({
        envNames: ["EXPO_IOS_GOOGLE_SERVICES_FILE", "IOS_GOOGLE_SERVICES_FILE"],
        fallbackRelativePath: "GoogleService-Info.plist",
        platform: "iOS",
        platformKey: "ios",
      })
    : "";

  if (iosGoogleServicesFile) {
    iosConfig.googleServicesFile = iosGoogleServicesFile;
  } else {
    delete iosConfig.googleServicesFile;
  }

  return {
    ...config,
    name: config.name || APP_NAME,
    slug: expoSlug,
    owner: expoOwner,
    version: appRelease.version,
    runtimeVersion: appRelease.runtimeVersion,
    updates: {
      ...(config.updates || {}),
      fallbackToCacheTimeout: 0,
      url: updatesUrl,
    },
    ...(GENERATE_IOS_NATIVE_CONFIG
      ? {
          icon: iosPrebuild.icon,
          ios: iosConfig,
          orientation: iosPrebuild.orientation,
          plugins: [...iosPrebuild.plugins, "expo-asset"],
          scheme: iosPrebuild.scheme,
          splash: iosPrebuild.splash,
        }
      : {}),
    extra: {
      ...configuredExtra,
      eas: {
        ...configuredEas,
        projectId: easProjectId,
      },
      appEnv: APP_ENV,
      appScheme: APP_SCHEME,
      releaseChannel: RELEASE_CHANNEL,
      releaseName: `${expoSlug}@${appRelease.version}:${RELEASE_CHANNEL}`,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
      sentryReplaysOnErrorSampleRate:
        process.env.EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || "",
      sentryReplaysSessionQuality: process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_QUALITY || "",
      sentryReplaysSessionSampleRate:
        process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || "",
      sentryProject: process.env.SENTRY_PROJECT || "",
      sentryOrg: process.env.SENTRY_ORG || "",
    },
  };
};

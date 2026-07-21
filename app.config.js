const fs = require("fs");
const path = require("path");

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || "development";
const RELEASE_CHANNEL = process.env.EXPO_PUBLIC_RELEASE_CHANNEL || APP_ENV;
const EAS_BUILD_PLATFORM = (process.env.EAS_BUILD_PLATFORM || "").trim().toLowerCase();
const APP_SCHEME =
  (process.env.EXPO_PUBLIC_APP_SCHEME || "ogrencisosyalagi").trim() || "ogrencisosyalagi";
const APP_NAME = (process.env.EXPO_PUBLIC_APP_NAME || "UniVerse").trim() || "UniVerse";
const APP_SLUG = (process.env.EXPO_PUBLIC_EXPO_SLUG || process.env.EXPO_SLUG || "").trim();
const DEFAULT_EXPO_OWNER = "cayanns-team";
const DEFAULT_EXPO_SLUG = "universe";
const DEFAULT_EAS_PROJECT_ID = "c7565eaa-d013-430f-9576-217c4beefa3f";
const ANDROID_PACKAGE =
  (process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "").trim() || "com.ogrencisosyalagi.app";

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
  if (APP_ENV !== "production") {
    return false;
  }
  if (!EAS_BUILD_PLATFORM) {
    return true;
  }
  return EAS_BUILD_PLATFORM === platformKey;
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
  const runtimeVersion =
    typeof config.runtimeVersion === "string" && config.runtimeVersion.trim()
      ? config.runtimeVersion.trim()
      : config.version || "1.0.0";
  const iosConfig = {
    ...(config.ios || {}),
  };
  const androidConfig = {
    ...(config.android || {}),
    package: ANDROID_PACKAGE,
  };
  const iosGoogleServicesFile = resolveGoogleServicesFile({
    envNames: ["EXPO_IOS_GOOGLE_SERVICES_FILE", "IOS_GOOGLE_SERVICES_FILE"],
    fallbackRelativePath: "GoogleService-Info.plist",
    platform: "iOS",
    platformKey: "ios",
  });
  const androidGoogleServicesFile = resolveGoogleServicesFile({
    envNames: ["EXPO_ANDROID_GOOGLE_SERVICES_FILE", "ANDROID_GOOGLE_SERVICES_FILE"],
    fallbackRelativePath: "android/app/src/release/google-services.json",
    platform: "Android",
    platformKey: "android",
  });

  if (iosGoogleServicesFile) {
    iosConfig.googleServicesFile = iosGoogleServicesFile;
  } else {
    delete iosConfig.googleServicesFile;
  }

  if (androidGoogleServicesFile) {
    androidConfig.googleServicesFile = androidGoogleServicesFile;
  } else {
    delete androidConfig.googleServicesFile;
  }

  return {
    ...config,
    name: config.name || APP_NAME,
    slug: expoSlug,
    owner: expoOwner,
    plugins: Array.from(new Set([...(config.plugins || []), "expo-asset"])),
    android: androidConfig,
    ios: iosConfig,
    runtimeVersion,
    updates: {
      ...(config.updates || {}),
      fallbackToCacheTimeout: 0,
      url: updatesUrl,
    },
    extra: {
      ...configuredExtra,
      eas: {
        ...configuredEas,
        projectId: easProjectId,
      },
      appEnv: APP_ENV,
      appScheme: APP_SCHEME,
      releaseChannel: RELEASE_CHANNEL,
      releaseName: `${expoSlug}@${config.version || "1.0.0"}:${RELEASE_CHANNEL}`,
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

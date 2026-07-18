#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_ANDROID_PACKAGE = "com.ogrencisosyalagi.app";
const ANDROID_GOOGLE_SERVICES_ENV_NAMES = [
  "EXPO_ANDROID_GOOGLE_SERVICES_FILE",
  "ANDROID_GOOGLE_SERVICES_FILE",
];
const ANDROID_GOOGLE_SERVICES_TARGET = path.join(
  "android",
  "app",
  "src",
  "release",
  "google-services.json",
);

function readFirstEnv(env, names) {
  for (const name of names) {
    const value = String(env[name] || "").trim();
    if (value) {
      return { name, value };
    }
  }
  return { name: "", value: "" };
}

function normalizePlatform(env) {
  return String(env.EAS_BUILD_PLATFORM || "")
    .trim()
    .toLowerCase();
}

function shouldSkipAndroid(env) {
  const platform = normalizePlatform(env);
  return Boolean(platform && platform !== "android");
}

function isAndroidConfigRequired(env) {
  if (String(env.MATERIALIZE_NATIVE_CONFIG_REQUIRED || "").trim() === "true") {
    return true;
  }
  if (shouldSkipAndroid(env)) {
    return false;
  }
  return (
    String(env.EXPO_PUBLIC_APP_ENV || "").trim() === "production" ||
    String(env.EAS_BUILD_PROFILE || "").trim() === "production"
  );
}

function resolveRoot(explicitRoot) {
  return path.resolve(explicitRoot || process.env.MATERIALIZE_NATIVE_CONFIG_ROOT || process.cwd());
}

function resolveExpectedAndroidPackage(root, env) {
  const configuredPackage = String(env.EXPO_PUBLIC_ANDROID_PACKAGE || "").trim();
  if (configuredPackage) {
    return configuredPackage;
  }

  const appJsonPath = path.join(root, "app.json");
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
    const appPackage = String(appJson?.expo?.android?.package || "").trim();
    return appPackage || DEFAULT_ANDROID_PACKAGE;
  } catch (_error) {
    return DEFAULT_ANDROID_PACKAGE;
  }
}

function parseGoogleServicesJson(sourcePath) {
  let raw = "";
  try {
    raw = fs.readFileSync(sourcePath, "utf8");
  } catch (error) {
    throw new Error(
      `[native-config] Android Google services source could not be read: ${error.message}`,
    );
  }

  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch (_error) {
    throw new Error("[native-config] Android Google services source must be valid JSON.");
  }
}

function getAndroidClientPackages(config) {
  const clients = Array.isArray(config?.client) ? config.client : [];
  return clients
    .map((client) => String(client?.client_info?.android_client_info?.package_name || "").trim())
    .filter(Boolean);
}

function assertSourceFile(sourcePath) {
  let stat;
  try {
    stat = fs.statSync(sourcePath);
  } catch (_error) {
    throw new Error("[native-config] Android Google services source file was not found.");
  }

  if (!stat.isFile()) {
    throw new Error("[native-config] Android Google services source must be a regular file.");
  }
}

function materializeAndroidGoogleServices(options = {}) {
  const root = resolveRoot(options.root);
  const env = options.env || process.env;
  const log = options.log || console.log;

  if (shouldSkipAndroid(env)) {
    log(
      "[native-config] Skipping Android Google services materialization for non-Android EAS build.",
    );
    return { skipped: true, reason: "non-android-platform" };
  }

  const configuredPath = readFirstEnv(env, ANDROID_GOOGLE_SERVICES_ENV_NAMES);
  if (!configuredPath.value) {
    if (isAndroidConfigRequired(env)) {
      throw new Error(
        `[native-config] ${ANDROID_GOOGLE_SERVICES_ENV_NAMES.join(" or ")} is required for Android production builds.`,
      );
    }
    log(
      "[native-config] Android Google services file-secret env is not set; nothing to materialize.",
    );
    return { skipped: true, reason: "missing-env" };
  }

  const sourcePath = path.isAbsolute(configuredPath.value)
    ? configuredPath.value
    : path.resolve(root, configuredPath.value);
  assertSourceFile(sourcePath);

  const { raw, parsed } = parseGoogleServicesJson(sourcePath);
  const expectedPackage = resolveExpectedAndroidPackage(root, env);
  const clientPackages = getAndroidClientPackages(parsed);
  if (!clientPackages.includes(expectedPackage)) {
    throw new Error(
      `[native-config] Android Google services package mismatch. Expected ${expectedPackage}.`,
    );
  }

  const targetPath = path.join(root, ANDROID_GOOGLE_SERVICES_TARGET);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, raw);

  log(`[native-config] Android Google services config materialized for ${expectedPackage}.`);
  return {
    skipped: false,
    packageName: expectedPackage,
    sourceEnvName: configuredPath.name,
    targetPath,
  };
}

if (require.main === module) {
  try {
    materializeAndroidGoogleServices();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  ANDROID_GOOGLE_SERVICES_ENV_NAMES,
  ANDROID_GOOGLE_SERVICES_TARGET,
  DEFAULT_ANDROID_PACKAGE,
  getAndroidClientPackages,
  materializeAndroidGoogleServices,
  resolveExpectedAndroidPackage,
};

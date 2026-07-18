import Constants from "expo-constants";

export type AppReleaseEnvironment = "development" | "preview" | "production";

export interface AppReleaseMeta {
  appEnv: AppReleaseEnvironment;
  appVersion: string;
  releaseChannel: string;
  releaseName: string;
  runtimeVersion: string;
  sentryDsn: string;
}

export interface CrashReporterConfig {
  dist?: string;
  dsn: string;
  enabled: boolean;
  environment: string;
  profilesSampleRate: number;
  replaysOnErrorSampleRate: number;
  replaysSessionQuality: "high" | "low" | "medium";
  replaysSessionSampleRate: number;
  release: string;
  tracesSampleRate: number;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clampSampleRate(value: unknown, fallback: number) {
  const parsed = readNumber(value, fallback);
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function normalizeReplayQuality(value: unknown, fallback: "high" | "low" | "medium") {
  return value === "high" || value === "low" || value === "medium" ? value : fallback;
}

function normalizeAppEnv(value: string): AppReleaseEnvironment {
  if (value === "preview" || value === "production") return value;
  return "development";
}

const expoExtra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
const appVersion = readString(Constants.expoConfig?.version, "1.0.0");
const runtimeVersionValue = Constants.expoConfig?.runtimeVersion;
const runtimeVersion = typeof runtimeVersionValue === "string" ? runtimeVersionValue : appVersion;
const appEnv = normalizeAppEnv(
  readString(expoExtra.appEnv, process.env.EXPO_PUBLIC_APP_ENV || "development"),
);
const releaseChannel = readString(
  expoExtra.releaseChannel,
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL || appEnv,
);
const releaseName = readString(
  expoExtra.releaseName,
  `ogrencisosyalagi@${appVersion}:${releaseChannel}`,
);
const sentryDsn = readString(expoExtra.sentryDsn, process.env.EXPO_PUBLIC_SENTRY_DSN || "");
const defaultReplaySessionSampleRate = appEnv === "production" ? 0.05 : 1;
const defaultReplaySessionQuality = appEnv === "production" ? "medium" : "high";
const replaysSessionSampleRate = clampSampleRate(
  expoExtra.sentryReplaysSessionSampleRate ??
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  defaultReplaySessionSampleRate,
);
const replaysOnErrorSampleRate = clampSampleRate(
  expoExtra.sentryReplaysOnErrorSampleRate ??
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  1,
);
const replaysSessionQuality = normalizeReplayQuality(
  expoExtra.sentryReplaysSessionQuality ?? process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_QUALITY,
  defaultReplaySessionQuality,
);

export const appReleaseMeta: AppReleaseMeta = {
  appEnv,
  appVersion,
  releaseChannel,
  releaseName,
  runtimeVersion,
  sentryDsn,
};

export const crashReporterConfig: CrashReporterConfig = {
  dist: runtimeVersion,
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: appEnv,
  profilesSampleRate: appEnv === "production" ? 0.15 : 1,
  replaysOnErrorSampleRate,
  replaysSessionQuality,
  replaysSessionSampleRate,
  release: releaseName,
  tracesSampleRate: appEnv === "production" ? 0.2 : 1,
};

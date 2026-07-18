import { IS_DEVELOPMENT_RUNTIME, IS_TEST_RUNTIME, readBooleanEnv } from "../config/runtime";
import { redactString, redactValue } from "../security/redaction";

const DEV_DEFAULT = typeof __DEV__ !== "undefined" ? __DEV__ : !IS_TEST_RUNTIME;
const FORCE_DEBUG_VERBOSE = readBooleanEnv("EXPO_PUBLIC_DEBUG_VERBOSE", false);

const DEBUG_VERBOSE =
  IS_DEVELOPMENT_RUNTIME && (FORCE_DEBUG_VERBOSE || (!IS_TEST_RUNTIME && DEV_DEFAULT));
const DEBUG_SCROLL = IS_DEVELOPMENT_RUNTIME && readBooleanEnv("EXPO_PUBLIC_DEBUG_SCROLL", false);
const DEBUG_SCROLL_VERBOSE =
  IS_DEVELOPMENT_RUNTIME && readBooleanEnv("EXPO_PUBLIC_DEBUG_SCROLL_VERBOSE", false);

function padTime(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatTimestamp(date = new Date()) {
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}.${padTime(date.getMilliseconds(), 3)}`;
}

function format(scope: string, message: string) {
  return `[DBG][${formatTimestamp()}][${scope}] ${redactString(message)}`;
}

export function isVerboseDebugEnabled() {
  return DEBUG_VERBOSE;
}

export function isScrollDebugEnabled() {
  return DEBUG_SCROLL || DEBUG_SCROLL_VERBOSE;
}

export function isScrollVerboseDebugEnabled() {
  return DEBUG_SCROLL_VERBOSE;
}

export function debugLog(scope: string, message: string, payload?: unknown) {
  if (!DEBUG_VERBOSE) return;
  if (payload === undefined) {
    // Centralized, redacted development logger is the only intentional console boundary.
    // eslint-disable-next-line no-console
    console.info(format(scope, message));
    return;
  }
  // eslint-disable-next-line no-console
  console.info(format(scope, message), redactValue(payload));
}

export function debugWarn(scope: string, message: string, payload?: unknown) {
  if (!DEBUG_VERBOSE) return;
  if (payload === undefined) {
    // eslint-disable-next-line no-console
    console.warn(format(scope, message));
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(format(scope, message), redactValue(payload));
}

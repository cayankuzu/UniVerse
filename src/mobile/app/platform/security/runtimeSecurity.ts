import { NativeModules, Platform } from "react-native";
import {
  APP_ENV,
  APP_SCHEME,
  AUTH_VERIFICATION_BYPASS_ENABLED,
  IS_PRODUCTION_RUNTIME,
  RUNTIME_FLAGS,
} from "../config/runtime";
import {
  SUPABASE_FUNCTIONS_BASE_URL_VALIDATED,
  SUPABASE_PUBLIC_URL_VALIDATED,
} from "../config/publicEnv";
import { recordSecurityTelemetryEvent } from "./securityTelemetry";

type NativeSecurityRuntimeSignals = {
  debugBridgeEnabled?: boolean;
  debuggerAttached?: boolean;
  isDeveloperModeEnabled?: boolean;
  isDeviceRooted?: boolean;
  isEmulator?: boolean;
  isJailbroken?: boolean;
  isSslPinningAvailable?: boolean;
  isSslPinningEnforced?: boolean;
};

type NativeSecurityRuntimeModule = {
  getSecuritySignals?: () => Promise<NativeSecurityRuntimeSignals>;
};

type RuntimeSecurityIssue = {
  code: string;
  severity: "high" | "medium";
};

function readNativeSecurityRuntimeModule() {
  return NativeModules.SecurityRuntime as NativeSecurityRuntimeModule | undefined;
}

function addIssue(issues: RuntimeSecurityIssue[], code: string, severity: "high" | "medium") {
  issues.push({ code, severity });
}

function collectStaticRuntimeSecurityIssues() {
  const issues: RuntimeSecurityIssue[] = [];
  if (AUTH_VERIFICATION_BYPASS_ENABLED) {
    addIssue(issues, "auth_verification_bypass_enabled", "high");
  }
  if (!RUNTIME_FLAGS.disableLegacyEdgeReads) {
    addIssue(issues, "legacy_edge_reads_enabled", "high");
  }
  if (IS_PRODUCTION_RUNTIME && typeof __DEV__ !== "undefined" && __DEV__) {
    addIssue(issues, "dev_runtime_flag_present", "high");
  }
  if (!/^https:\/\//i.test(SUPABASE_PUBLIC_URL_VALIDATED)) {
    addIssue(issues, "supabase_public_url_not_https", "high");
  }
  if (!/^https:\/\//i.test(SUPABASE_FUNCTIONS_BASE_URL_VALIDATED)) {
    addIssue(issues, "supabase_functions_url_not_https", "high");
  }
  if (!APP_SCHEME) {
    addIssue(issues, "app_scheme_missing", "high");
  }
  return issues;
}

async function collectNativeSecuritySignals() {
  const module = readNativeSecurityRuntimeModule();
  if (!module?.getSecuritySignals) {
    return {
      moduleAvailable: false,
      signals: {} as NativeSecurityRuntimeSignals,
    };
  }
  try {
    return {
      moduleAvailable: true,
      signals: await module.getSecuritySignals(),
    };
  } catch {
    return {
      moduleAvailable: true,
      signals: {} as NativeSecurityRuntimeSignals,
    };
  }
}

export async function runRuntimeSecurityChecks() {
  const issues = collectStaticRuntimeSecurityIssues();
  const nativeSignals = await collectNativeSecuritySignals();

  if (nativeSignals.signals.debuggerAttached || nativeSignals.signals.debugBridgeEnabled) {
    addIssue(issues, "debugger_attached", "high");
  }
  if (nativeSignals.signals.isDeviceRooted || nativeSignals.signals.isJailbroken) {
    addIssue(issues, "root_or_jailbreak_detected", "high");
  }
  if (
    nativeSignals.moduleAvailable &&
    nativeSignals.signals.isSslPinningAvailable &&
    !nativeSignals.signals.isSslPinningEnforced
  ) {
    addIssue(issues, "ssl_pinning_not_enforced", "medium");
  }
  if (nativeSignals.signals.isDeveloperModeEnabled) {
    addIssue(issues, "developer_mode_enabled", "medium");
  }

  recordSecurityTelemetryEvent({
    action: "runtime.security_check",
    meta: {
      appEnv: APP_ENV,
      appScheme: APP_SCHEME,
      issueCodes: issues.map((issue) => issue.code),
      moduleAvailable: nativeSignals.moduleAvailable,
      platform: Platform.OS,
      signals: {
        debugBridgeEnabled: Boolean(nativeSignals.signals.debugBridgeEnabled),
        debuggerAttached: Boolean(nativeSignals.signals.debuggerAttached),
        isDeveloperModeEnabled: Boolean(nativeSignals.signals.isDeveloperModeEnabled),
        isDeviceRooted: Boolean(nativeSignals.signals.isDeviceRooted),
        isEmulator: Boolean(nativeSignals.signals.isEmulator),
        isJailbroken: Boolean(nativeSignals.signals.isJailbroken),
        isSslPinningAvailable: Boolean(nativeSignals.signals.isSslPinningAvailable),
        isSslPinningEnforced: Boolean(nativeSignals.signals.isSslPinningEnforced),
      },
    },
    resourceId: APP_ENV,
    resourceType: "runtime",
    result: issues.length > 0 ? "fail" : "success",
  });

  return {
    issues,
    nativeSignals,
  };
}

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  ANDROID_GOOGLE_SERVICES_TARGET,
  materializeAndroidGoogleServices,
} = require("../../scripts/materialize-native-config.cjs");

const ROOT = process.cwd();
const PACKAGE_NAME = "com.ogrencisosyalagi.app";
const SECRET_MARKER = "SECRET_SHOULD_NOT_BE_LOGGED";

function makeTempRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "universe-native-config-"));
  fs.writeFileSync(
    path.join(tempRoot, "app.json"),
    JSON.stringify({ expo: { android: { package: PACKAGE_NAME } } }, null, 2),
  );
  return tempRoot;
}

function googleServicesJson(packageName) {
  return JSON.stringify(
    {
      project_info: {
        project_number: "1234567890",
        project_id: "universe-test",
        storage_bucket: "universe-test.appspot.com",
      },
      client: [
        {
          client_info: {
            mobilesdk_app_id: "1:1234567890:android:test",
            android_client_info: {
              package_name: packageName,
            },
          },
          api_key: [{ current_key: SECRET_MARKER }],
        },
      ],
      configuration_version: "1",
    },
    null,
    2,
  );
}

function runWithLogs(root, env) {
  const logs = [];
  const result = materializeAndroidGoogleServices({
    root,
    env,
    log: (message) => logs.push(String(message)),
  });
  return { result, logs };
}

function expectFailure(fn, pattern) {
  assert.throws(fn, pattern);
}

const missingEnvRoot = makeTempRoot();
expectFailure(
  () =>
    runWithLogs(missingEnvRoot, {
      EXPO_PUBLIC_APP_ENV: "production",
      EAS_BUILD_PLATFORM: "android",
    }),
  /EXPO_ANDROID_GOOGLE_SERVICES_FILE/,
);

const missingSourceRoot = makeTempRoot();
expectFailure(
  () =>
    runWithLogs(missingSourceRoot, {
      EXPO_PUBLIC_APP_ENV: "production",
      EAS_BUILD_PLATFORM: "android",
      EXPO_ANDROID_GOOGLE_SERVICES_FILE: path.join(missingSourceRoot, "missing.json"),
    }),
  /source file was not found/,
);

const badJsonRoot = makeTempRoot();
const badJsonPath = path.join(badJsonRoot, "bad.json");
fs.writeFileSync(badJsonPath, "{not-json");
expectFailure(
  () =>
    runWithLogs(badJsonRoot, {
      EXPO_PUBLIC_APP_ENV: "production",
      EAS_BUILD_PLATFORM: "android",
      EXPO_ANDROID_GOOGLE_SERVICES_FILE: badJsonPath,
    }),
  /valid JSON/,
);

const wrongPackageRoot = makeTempRoot();
const wrongPackagePath = path.join(wrongPackageRoot, "google-services.json");
fs.writeFileSync(wrongPackagePath, googleServicesJson("com.example.wrong"));
expectFailure(
  () =>
    runWithLogs(wrongPackageRoot, {
      EXPO_PUBLIC_APP_ENV: "production",
      EAS_BUILD_PLATFORM: "android",
      EXPO_ANDROID_GOOGLE_SERVICES_FILE: wrongPackagePath,
    }),
  /package mismatch/,
);

const validRoot = makeTempRoot();
const validPath = path.join(validRoot, "source-google-services.json");
const validContent = googleServicesJson(PACKAGE_NAME);
fs.writeFileSync(validPath, validContent);
const { result, logs } = runWithLogs(validRoot, {
  EXPO_PUBLIC_APP_ENV: "production",
  EAS_BUILD_PLATFORM: "android",
  EXPO_ANDROID_GOOGLE_SERVICES_FILE: validPath,
});
const targetPath = path.join(validRoot, ANDROID_GOOGLE_SERVICES_TARGET);
assert.strictEqual(result.skipped, false);
assert.strictEqual(fs.readFileSync(targetPath, "utf8"), validContent);
assert(
  !logs.join("\n").includes(SECRET_MARKER),
  "materialization logs must not include secret contents",
);

const iosOnlyRoot = makeTempRoot();
const iosOnly = runWithLogs(iosOnlyRoot, {
  EXPO_PUBLIC_APP_ENV: "production",
  EAS_BUILD_PLATFORM: "ios",
});
assert.strictEqual(iosOnly.result.skipped, true);
assert.strictEqual(iosOnly.result.reason, "non-android-platform");

const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
assert(
  gitignore.includes("android/app/src/release/google-services.json"),
  ".gitignore must exclude materialized Android Google services output",
);

console.log("[native-config-guard] OK: native config materialization contract is enforced.");

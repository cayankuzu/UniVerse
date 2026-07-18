function isAffirmative(value) {
  return /^(1|true|yes)$/i.test(String(value || "").trim());
}

if (!isAffirmative(process.env.RELEASE_NATIVE_SYMBOLS_VERIFIED)) {
  console.error(
    "[release-native-symbols] Native symbol verification is not confirmed. " +
      "Verify native symbol upload for the target release in Sentry, then set RELEASE_NATIVE_SYMBOLS_VERIFIED=true.",
  );
  process.exit(1);
}

console.log("[release-native-symbols] OK: native symbol verification is confirmed.");

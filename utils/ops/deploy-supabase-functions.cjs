"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const supabaseDir = path.join(repoRoot, "supabase");
const envPath = path.join(repoRoot, ".env");
const projectRefPath = path.join(supabaseDir, ".temp", "project-ref");

function readEnvValue(key) {
  if (!fs.existsSync(envPath)) {
    return "";
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    if (trimmed.slice(0, separatorIndex).trim() !== key) {
      continue;
    }
    return trimmed.slice(separatorIndex + 1).trim();
  }
  return "";
}

function projectRefFromSupabaseUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }
  try {
    const host = new URL(value).hostname;
    return host.endsWith(".supabase.co") ? host.replace(/\.supabase\.co$/, "") : "";
  } catch {
    return "";
  }
}

const projectRef =
  String(process.env.SUPABASE_PROJECT_REF || "").trim() ||
  projectRefFromSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL) ||
  projectRefFromSupabaseUrl(process.env.SUPABASE_URL) ||
  projectRefFromSupabaseUrl(readEnvValue("EXPO_PUBLIC_SUPABASE_URL")) ||
  projectRefFromSupabaseUrl(readEnvValue("SUPABASE_URL")) ||
  (fs.existsSync(projectRefPath) ? String(fs.readFileSync(projectRefPath, "utf8")).trim() : "");
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const deployAll = process.argv.includes("--all");

function fail(message) {
  console.error(`[supabase-deploy] ${message}`);
  process.exit(1);
}

function run(label, args) {
  console.log(`[supabase-deploy] ${label}`);
  const result = spawnSync(
    process.platform === "win32" ? "cmd.exe" : npxCommand,
    process.platform === "win32" ? ["/d", "/s", "/c", [npxCommand, ...args].join(" ")] : args,
    {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    fail(`${label} basarisiz: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(supabaseDir)) {
  fail("supabase klasoru bulunamadi.");
}

if (!projectRef) {
  fail(
    "Supabase project ref bulunamadi. SUPABASE_PROJECT_REF, SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_URL gerekli.",
  );
}

if (!accessToken) {
  console.warn(
    [
      "[supabase-deploy] SUPABASE_ACCESS_TOKEN eksik.",
      "Kayitli bir Supabase CLI oturumu varsa deploy yine denenir.",
      "Yetki hatasi alirsan 'supabase login' veya SUPABASE_ACCESS_TOKEN gerekli.",
    ].join(" "),
  );
}

if (deployAll) {
  run("Pending migration'lar deploy ediliyor", ["supabase", "db", "push", "--linked"]);
}

run("Edge function 'server' deploy ediliyor", [
  "supabase",
  "functions",
  "deploy",
  "server",
  "--project-ref",
  projectRef,
]);

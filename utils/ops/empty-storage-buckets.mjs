import { createClient } from "@supabase/supabase-js";

function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

const supabaseUrl = readEnv("SUPABASE_URL") || readEnv("EXPO_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY") || readEnv("SUPABASE_SERVICE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    [
      "Missing required environment variables.",
      "Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    ].join(" "),
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    throw bucketsError;
  }

  if (!Array.isArray(buckets) || buckets.length === 0) {
    console.log("No storage buckets found.");
    return;
  }

  for (const bucket of buckets) {
    const bucketId = String(bucket.id || "").trim();
    if (!bucketId) continue;
    console.log(`Emptying bucket: ${bucketId}`);
    const { error } = await supabase.storage.emptyBucket(bucketId);
    if (error) {
      throw new Error(`Failed to empty bucket '${bucketId}': ${error.message}`);
    }
  }

  console.log("All storage buckets emptied.");
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});

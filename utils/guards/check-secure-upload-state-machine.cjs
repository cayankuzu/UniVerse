const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migration = read("supabase/migrations/20260718153000_secure_upload_state_machine.sql");
const scanner = read("supabase/functions/server/routes/storageMediaScan.ts");
const confirmRoute = read(
  "supabase/functions/server/routes/discovery.storageUploadConfirmRoute.ts",
);
const albumProcessor = read("src/mobile/app/features/events/data/albumUploadQueueProcessor.ts");
const albumMediaProcessor = read(
  "src/mobile/app/features/events/data/albumUploadQueueProcessor.media.ts",
);
const semgrepIgnore = read(".semgrepignore");
const resumableUpload = read("src/mobile/app/data/storage/storage.resumableUpload.ts");

function requirePattern(content, pattern, message) {
  if (!pattern.test(content)) throw new Error(`[secure-upload] ${message}`);
}

function rejectPattern(content, pattern, message) {
  if (pattern.test(content)) throw new Error(`[secure-upload] ${message}`);
}

requirePattern(
  migration,
  /scan_state in \('pending', 'passed', 'failed'\)/u,
  "scan state must not permit a skipped verdict.",
);
requirePattern(
  migration,
  /create or replace function public\.record_upload_scan_result/u,
  "transactional scan-result RPC is missing.",
);
requirePattern(
  migration,
  /create trigger album_photos_require_verified_upload/u,
  "verified album publication trigger is missing.",
);
requirePattern(
  migration,
  /create table if not exists public\.storage_cleanup_jobs/u,
  "durable rejected-object cleanup queue is missing.",
);
requirePattern(
  scanner,
  /if \(!webhookUrl \|\| !webhookToken\)[\s\S]*throw new MediaScanError/u,
  "scanner configuration must fail closed.",
);
requirePattern(
  confirmRoute,
  /rpc\("record_upload_scan_result"/u,
  "upload confirmation must persist the scanner verdict transactionally.",
);
requirePattern(
  albumMediaProcessor,
  /checksum: fileInfo\.checksumSha256/u,
  "mobile session must bind the expected SHA-256 checksum.",
);
requirePattern(
  albumMediaProcessor,
  /IMAGE_PREPARE_CONCURRENCY\s*=\s*2[\s\S]*VIDEO_PREPARE_CONCURRENCY\s*=\s*1[\s\S]*MEDIA_UPLOAD_CONCURRENCY\s*=\s*2/u,
  "media preparation and upload concurrency must remain explicitly bounded.",
);
requirePattern(
  resumableUpload,
  /findPreviousUploads\(\)[\s\S]*resumeFromPreviousUpload/u,
  "large uploads must remain resumable after interruption.",
);
requirePattern(
  albumProcessor,
  /await StorageAPI\.finalizeUploadSession/u,
  "mobile publication must verify session finalization.",
);
rejectPattern(
  albumProcessor,
  /finalizeUploadSession\([^;]+\.catch\(/u,
  "session finalization errors must not be swallowed.",
);
rejectPattern(
  semgrepIgnore,
  /android\/app\/src\/main\/AndroidManifest\.xml/u,
  "AndroidManifest must remain visible to native SAST.",
);

console.log("[secure-upload] OK: fail-closed media publication invariants are enforced.");

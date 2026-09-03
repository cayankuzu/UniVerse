import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositoryRoot = new URL("../../../../", import.meta.url);
const readRepositoryFile = (relativePath) =>
  readFileSync(new URL(relativePath, repositoryRoot), "utf8");

test("installation generations and tombstones are server-owned, private, and serialized", () => {
  const migration = readRepositoryFile(
    "supabase/migrations/20260831163000_push_installation_account_switch_hardening.sql",
  );

  assert.match(migration, /add column if not exists installation_id uuid/i);
  assert.match(migration, /create table if not exists public\.internal_push_installation_state/i);
  assert.match(
    migration,
    /owner_user_id uuid not null references public\.profiles\(user_id\) on delete cascade/i,
  );
  assert.match(
    migration,
    /alter table public\.internal_push_installation_state force row level security/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.internal_push_installation_state from authenticated/i,
  );
  assert.match(
    migration,
    /create unique index[\s\S]*one_active_installation[\s\S]*where installation_id is not null[\s\S]*and is_active/i,
  );
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/i);
  assert.match(migration, /p_generation < v_state\.generation/i);
  assert.match(migration, /p_generation = v_state\.generation/i);
  assert.match(migration, /v_state\.owner_user_id <> p_user_id/i);
  assert.match(
    migration,
    /p_generation = v_state\.generation[\s\S]*exists \([\s\S]*token\.installation_id = p_installation_id[\s\S]*token\.expo_push_token = p_expo_push_token[\s\S]*token\.is_active/i,
  );
  assert.match(migration, /create or replace function public\.tombstone_push_installation/i);
  assert.match(
    migration,
    /revoke all on function public\.register_push_device_token\(uuid, text, text, text, text, uuid, bigint\) from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.tombstone_push_installation\(uuid, text, text, text, text, uuid, bigint\) to service_role/i,
  );
});

test("authenticated routes validate generation and delegate ordered writes to service RPCs", () => {
  const route = readRepositoryFile("supabase/functions/server/routes/push.ts");
  const service = readRepositoryFile("supabase/functions/server/services/pushNotifications.ts");

  assert.match(service, /export function normalizePushInstallationId/);
  assert.match(route, /normalizePushGeneration/);
  assert.match(route, /hasGeneration[\s\S]*generation[\s\S]*parsedInstallationId/);
  assert.match(route, /adminSupabase\.rpc\("register_push_device_token"/);
  assert.match(route, /p_generation: payload\.generation/);
  assert.match(route, /adminSupabase\.rpc\("tombstone_push_installation"/);
  assert.match(route, /applied: result\.applied/);
  assert.match(route, /typeof item\?\.applied !== "boolean"/);
  assert.match(route, /push-token-register-result-invalid/);
  assert.match(route, /push-installation-tombstone-result-invalid/);
  assert.match(route, /scope: "push-unregister"/);
  assert.match(
    route,
    /\.eq\("user_id", user\.id\)[\s\S]*\.eq\("expo_push_token", payload\.expoPushToken\)[\s\S]*\.select\("id"\)[\s\S]*\.maybeSingle\(\)/,
  );
  assert.match(route, /applied: Boolean\(deactivatedToken\)/);
  assert.doesNotMatch(route, /from\("push_device_tokens"\)\.upsert/);
});

test("mobile persistence rejects unapplied cleanup and stale local registration writes", () => {
  const mobile = readRepositoryFile("src/mobile/app/data/notifications/notifications.push.ts");
  const effect = readRepositoryFile("src/mobile/app/app-shell/bridges/usePushRegistrationSync.ts");

  assert.match(mobile, /const runPushStorageOperation = createSerializedStorageOperation\(\)/);
  assert.match(mobile, /stored\.generation \+ 1/);
  assert.match(mobile, /installation\.generation !== value\.generation[\s\S]*return false/);
  assert.match(
    mobile,
    /normalizeMutationResponse\(response\)[\s\S]*observeServerGeneration[\s\S]*requireConfirmedMutation[\s\S]*unregister-unconfirmed/,
  );
  assert.match(effect, /new AbortController\(\)/);
  assert.match(effect, /activeUserIdRef\.current === userId/);
  assert.match(effect, /NotificationPushAPI\.isGenerationCurrent/);
  assert.match(effect, /NotificationPushAPI\.requireConfirmedMutation/);
  assert.match(
    effect,
    /normalizeMutationResponse\(response\)[\s\S]*observeServerGeneration[\s\S]*requireConfirmedMutation/,
  );
  assert.match(effect, /requestController\?\.abort\(\)/);
  assert.match(mobile, /import \* as Crypto from "expo-crypto"/);
  assert.match(mobile, /Crypto\.randomUUID\(\)/);
  assert.match(mobile, /item\.success !== true[\s\S]*typeof item\.applied !== "boolean"/);
  assert.match(mobile, /normalizeLegacyStoredPushRegistration/);
  assert.match(
    mobile,
    /prepared\.legacyRegistration[\s\S]*"\/push\/unregister"[\s\S]*expoPushToken:/,
  );
  assert.doesNotMatch(mobile, /Math\.random\(\)/);
});

test("delivery leases bind the current recipient and legacy rollback fails closed", () => {
  const migration = readRepositoryFile(
    "supabase/migrations/20260831173000_push_delivery_privacy_leases.sql",
  );
  const processor = readRepositoryFile(
    "supabase/functions/server/services/pushDispatchProcessor.ts",
  );
  const queue = readRepositoryFile("supabase/functions/server/services/pushDispatchQueue.ts");

  assert.match(migration, /add column if not exists delivery_revision bigint/i);
  assert.match(
    migration,
    /create or replace function public\.claim_notification_push_delivery_leases/i,
  );
  assert.match(
    migration,
    /create or replace function public\.consume_notification_push_delivery_lease/i,
  );
  assert.match(
    migration,
    /token\.user_id = notification\.user_id[\s\S]*token\.is_active[\s\S]*token\.app_env = p_app_env/i,
  );
  assert.match(migration, /state\.owner_user_id = notification\.user_id/i);
  assert.match(migration, /state\.generation = delivery\.installation_generation/i);
  assert.match(
    migration,
    /status = 'error'[\s\S]*lease_consumed_at is null[\s\S]*status = 'pending'[\s\S]*lease_consumed_at is null/i,
  );
  assert.match(
    migration,
    /lease_consumed_at = pg_catalog\.timezone\('utc',[\s\S]*lease_expires_at = pg_catalog\.timezone\('utc',[\s\S]*interval '30 seconds'/i,
  );
  assert.match(
    migration,
    /create or replace function public\.finalize_notification_push_delivery/i,
  );
  assert.match(migration, /recipient_profile\.notification_preferences->>'push'/i);
  assert.match(
    migration,
    /not public\.is_blocked_pair\(notification\.user_id, notification\.actor_id\)/i,
  );
  assert.match(migration, /invalidate_push_delivery_leases_after_token_update/i);
  assert.match(migration, /invalidate_push_delivery_leases_after_installation_update/i);
  assert.match(migration, /enforce_push_installation_state_owner_cap/i);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*push-installation-owner:/i);
  assert.match(migration, /v_owner_state_count >= 64/i);
  assert.match(
    migration,
    /revoke execute on function public\.claim_notification_push_deliveries\(uuid, uuid\[\]\)[\s\S]*from service_role/i,
  );
  assert.match(processor, /\.rpc\([\s\S]*"claim_notification_push_delivery_leases"/);
  assert.match(processor, /"consume_notification_push_delivery_lease"/);
  assert.match(processor, /"finalize_notification_push_delivery"/);
  assert.match(processor, /p_release_for_retry: releaseForRetry/);
  assert.match(processor, /isRetryablePushTicketError\(ticket, ticket\.transportError\)/);
  assert.match(processor, /ticket\.transportStatus === undefined/);
  assert.match(processor, /push-delivery-finalization-failed/);
  assert.match(processor, /push-provider-outcome-unconfirmed/);
  assert.doesNotMatch(processor, /\.rpc\(\s*"claim_notification_push_deliveries"/);
  assert.doesNotMatch(processor, /\.from\("push_device_tokens"\)[\s\S]*\.update\(/);
  assert.match(queue, /ignoreDuplicates: true/);
  assert.match(queue, /crypto\.getRandomValues\(randomValue\)/);
  assert.match(queue, /clampRetryDelaySeconds\(entry\.attemptCount, entry\.retryAfterSeconds\)/);
});

test("remote push payload is generic and contains only the opaque notification id", () => {
  const service = readRepositoryFile("supabase/functions/server/services/pushNotifications.ts");
  const bodyBuilder = service.match(/export function buildPushBody[\s\S]*?\n}/)?.[0] || "";
  const dataBuilder = service.match(/export function buildPushData[\s\S]*?\n}/)?.[0] || "";
  const titleBuilder = service.match(/export function buildPushTitle[\s\S]*?\n}/)?.[0] || "";

  assert.match(bodyBuilder, /return "Yeni bir bildirimin var\."/);
  assert.match(titleBuilder, /return DEFAULT_PUSH_TITLE/);
  assert.match(dataBuilder, /return \{ notificationId:/);
  assert.doesNotMatch(dataBuilder, /eventId|photoId|targetProfileId|fromUsername|targetType/);
  assert.doesNotMatch(bodyBuilder, /notification\.(detail|message)|actor\?\./);
  assert.doesNotMatch(titleBuilder, /actor\?\.(name|username|club_name)|notification\?\.message/);
});

test("Expo provider I/O is bounded and malformed success cannot complete dispatch", () => {
  const service = readRepositoryFile("supabase/functions/server/services/pushNotifications.ts");
  const receiptProcessor = readRepositoryFile(
    "supabase/functions/server/services/pushReceiptProcessor.ts",
  );

  assert.match(service, /EXPO_PUSH_REQUEST_TIMEOUT_MS = 8_000/);
  assert.match(service, /new AbortController\(\)[\s\S]*setTimeout\(\(\) => controller\.abort\(\)/);
  assert.match(service, /signal: controller\.signal[\s\S]*finally[\s\S]*clearTimeout\(timeout\)/);
  assert.match(service, /item\.status === "ok" && !ticketId/);
  assert.match(service, /errorCode: "MalformedExpoTicket"/);
  assert.match(service, /const status = item\.status === "ok" && ticketId \? "ok" : "error"/);
  assert.match(receiptProcessor, /EXPO_RECEIPT_REQUEST_TIMEOUT_MS = 8_000/);
  assert.match(
    receiptProcessor,
    /signal: controller\.signal[\s\S]*finally[\s\S]*clearTimeout\(timeout\)/,
  );
  assert.match(receiptProcessor, /if \(!updatedDelivery\) throw new Error/);
  assert.ok(
    receiptProcessor.indexOf('.from("push_device_tokens")') <
      receiptProcessor.lastIndexOf('.from("notification_push_deliveries")'),
    "receipt token deactivation must be attempted before the terminal delivery update",
  );
  assert.match(service, /response\.headers\.get\("retry-after"\)/);
  assert.match(service, /transportError, transportStatus: response\.status/);
  assert.match(service, /transportError: message/);
  assert.match(service, /provider-network-error:/);
});

test("SQL pack covers grants, stale ordering, compatibility, owner mismatch, and deletion purge", () => {
  const validation = readRepositoryFile(
    "supabase/validation/10_push_installation_account_switch.sql",
  );

  assert.match(validation, /begin;[\s\S]*rollback;/i);
  assert.match(validation, /has_function_privilege\([\s\S]*'anon'/i);
  assert.match(validation, /register_push_device_token\(uuid,text,text,text,text,uuid,bigint\)/i);
  assert.match(validation, /tombstone_push_installation\(uuid,text,text,text,text,uuid,bigint\)/i);
  assert.match(validation, /set local role service_role/i);
  assert.match(validation, /deferred register before logout must be rejected/i);
  assert.match(validation, /A-to-B out-of-order registration must reject late A/i);
  assert.match(validation, /equal conflicting generation must be rejected/i);
  assert.match(
    validation,
    /equal generation replay must reject state whose active token row moved away/i,
  );
  assert.match(
    validation,
    /higher generation must recover a token row moved to another installation/i,
  );
  assert.match(validation, /delayed A logout must not tombstone account B/i);
  assert.match(validation, /legacy registration without installation_id must remain compatible/i);
  assert.match(validation, /profile deletion must cascade-purge internal installation state/i);
  assert.match(validation, /00000000-0000-0000-0000-000000000000/);
});

test("SQL pack exercises pre-consume and post-consume account reassignment", () => {
  const validation = readRepositoryFile("supabase/validation/11_push_delivery_privacy_lease.sql");

  assert.match(validation, /begin;[\s\S]*rollback;/i);
  assert.match(validation, /claim_notification_push_delivery_leases/i);
  assert.match(validation, /consume_notification_push_delivery_lease/i);
  assert.match(validation, /A lease must not consume after token reassignment to B/i);
  assert.match(validation, /post-consume reassignment must invalidate/i);
  assert.match(validation, /environment mismatch must not claim a token/i);
  assert.match(validation, /65th installation state must be rejected/i);
  assert.match(validation, /expired consumed lease must not be reclaimed/i);
  assert.match(validation, /finalize RPC must atomically persist a valid provider ticket/i);
  assert.match(validation, /program_limit_exceeded/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const pushService = readFileSync(
  new URL("supabase/functions/server/services/pushNotifications.ts", root),
  "utf8",
);
const channel = readFileSync(
  new URL("src/mobile/app/platform/notifications/notificationChannel.ts", root),
  "utf8",
);

function functionSource(name) {
  const start = pushService.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, `${name} must stay exported from pushNotifications.ts`);
  const open = pushService.indexOf("{", pushService.indexOf(")", start));
  let depth = 0;
  for (let index = open; index < pushService.length; index += 1) {
    if (pushService[index] === "{") depth += 1;
    if (pushService[index] === "}") {
      depth -= 1;
      if (depth === 0) return pushService.slice(start, index + 1);
    }
  }
  throw new Error(`Could not delimit ${name}.`);
}

// The Android channel publishes notifications on the lock screen. That is only
// defensible while the wire payload carries no actor and no content, so the two
// decisions are pinned to each other here rather than in prose.
test("android channel keeps lock-screen visibility PUBLIC", () => {
  assert.match(
    channel,
    /lockscreenVisibility:\s*Notifications\.AndroidNotificationVisibility\.PUBLIC/,
  );
});

test("push title and body are constants, not derived from actor or content", () => {
  for (const name of ["buildPushTitle", "buildPushBody"]) {
    const source = functionSource(name);
    assert.doesNotMatch(
      source,
      /\b(?:actor|notification)\s*[.?]/,
      `${name} must not read actor or notification fields.`,
    );
    assert.doesNotMatch(source, /\$\{/, `${name} must not interpolate runtime values.`);
  }
});

test("push data carries the notification id and nothing else", () => {
  const source = functionSource("buildPushData");
  assert.match(source, /return\s*\{\s*notificationId:\s*String\(notification\.id[^}]*\}\s*;/);
  for (const field of [
    "actor_id",
    "detail",
    "event_id",
    "message",
    "photo_id",
    "target_profile_id",
    "type",
    "user_id",
    "username",
    "club_name",
    "name",
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`\b${field}\b`),
      `buildPushData must not expose ${field}.`,
    );
  }
});

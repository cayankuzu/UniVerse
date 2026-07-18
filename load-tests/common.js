import http from "k6/http";
import encoding from "k6/encoding";
import { check, sleep } from "k6";

const baseUrl = __ENV.K6_SUPABASE_URL || "";
const anonKey = __ENV.K6_SUPABASE_ANON_KEY || "";
const accessTokenOverride = __ENV.K6_ACCESS_TOKEN || "";
const authMode = String(__ENV.K6_AUTH_MODE || "")
  .trim()
  .toLowerCase();
const email = __ENV.K6_TEST_EMAIL || "";
const password = __ENV.K6_TEST_PASSWORD || "";
const targetProfileUsername = __ENV.K6_PROFILE_USERNAME || "";
const targetProfileId = __ENV.K6_TARGET_PROFILE_ID || "";
const targetClubId = __ENV.K6_TARGET_CLUB_ID || "";
const targetEventCommentId = __ENV.K6_EVENT_COMMENT_ID || "";
const targetEventId = __ENV.K6_EVENT_ID || "";
const targetAlbumCommentId = __ENV.K6_ALBUM_COMMENT_ID || "";
const targetPhotoId = __ENV.K6_PHOTO_ID || "";
const targetNotificationId = __ENV.K6_NOTIFICATION_ID || "";
let cachedSession = null;

function resolveAuthMode() {
  if (accessTokenOverride) return "token";
  if (authMode === "anon") return "anon";
  return "password";
}

function decodeJwtExpiryMs(token) {
  try {
    const segments = String(token || "").split(".");
    if (segments.length < 2) return 0;
    const payload = JSON.parse(encoding.b64decode(segments[1], "rawurl", "s"));
    const exp = Number(payload?.exp || 0);
    return exp > 0 ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function jsonHeaders(token, tags = {}) {
  return {
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
    },
    tags: {
      auth_mode: resolveAuthMode(),
      ...(tags || {}),
    },
  };
}

export function signIn() {
  const response = http.post(
    `${baseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    jsonHeaders(anonKey, {
      endpoint: "auth.sign_in",
      request_kind: "auth",
    }),
  );
  check(response, {
    "auth status 200": (r) => r.status === 200,
    "auth has token": (r) => Boolean(r.json("access_token")),
  });
  const token = String(response.json("access_token") || "");
  cachedSession = token
    ? {
        expiresAt: decodeJwtExpiryMs(token),
        token,
      }
    : null;
  return token;
}

export function getAccessToken() {
  if (accessTokenOverride) {
    return accessTokenOverride;
  }
  if (authMode === "anon") {
    return anonKey;
  }
  const now = Date.now();
  if (cachedSession?.token && cachedSession.expiresAt > now + 60_000) {
    return cachedSession.token;
  }
  return signIn();
}

export function callRpc(token, fn, body, options = {}) {
  const tags = {
    endpoint: fn,
    request_kind: "projection",
    ...(options.tags || {}),
  };
  const response = http.post(
    `${baseUrl}/rest/v1/rpc/${fn}`,
    JSON.stringify(body || {}),
    jsonHeaders(token, tags),
  );
  check(response, {
    [`${fn} status < 500`]: (r) => r.status < 500,
  });
  return response;
}

export function readNextCursor(response) {
  try {
    const payload = response.json();
    return String(payload?.next_cursor || "").trim();
  } catch {
    return "";
  }
}

export function callRpcWithCursor(token, fn, body, options = {}) {
  const firstResponse = callRpc(token, fn, body, options);
  const nextCursor = readNextCursor(firstResponse);
  if (!options.append || !nextCursor) {
    return { firstResponse, nextCursor, secondResponse: null };
  }
  const secondResponse = callRpc(
    token,
    fn,
    {
      ...(body || {}),
      cursor: nextCursor,
    },
    {
      tags: {
        ...(options.tags || {}),
        page: "append",
      },
    },
  );
  return { firstResponse, nextCursor, secondResponse };
}

function normalizeProjectionValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function createProjectionTracker(options = {}) {
  return {
    appendEvery: readIntEnv(options.appendEveryEnv || "", options.appendEvery || 0),
    cycles: 0,
    deltaToken: null,
    fullRefreshEvery: readIntEnv(options.fullRefreshEveryEnv || "", options.fullRefreshEvery || 0),
    since: null,
  };
}

function shouldForceFullRefresh(tracker) {
  return (
    tracker.fullRefreshEvery > 0 &&
    tracker.cycles > 0 &&
    tracker.cycles % tracker.fullRefreshEvery === 0
  );
}

function buildTrackedProjectionContext(tracker) {
  if (shouldForceFullRefresh(tracker)) {
    tracker.deltaToken = null;
    tracker.since = null;
  }
  const useDelta = Boolean(tracker.deltaToken && tracker.since);
  return {
    deltaToken: useDelta ? tracker.deltaToken : null,
    since: useDelta ? tracker.since : null,
    useDelta,
  };
}

export function syncProjectionTracker(tracker, response) {
  tracker.cycles += 1;
  try {
    const payload = response.json();
    tracker.deltaToken = normalizeProjectionValue(
      payload?.delta_token || payload?.deltaToken || payload?.server_time || payload?.serverTime,
    );
    tracker.since = normalizeProjectionValue(payload?.server_time || payload?.serverTime);
  } catch {
    // Ignore parse failures and preserve the last successful delta state.
  }
}

export function callTrackedProjection(token, fn, body, tracker, options = {}) {
  const context = buildTrackedProjectionContext(tracker);
  const response = callRpc(
    token,
    fn,
    {
      ...(body || {}),
      delta_token: context.deltaToken,
      since: context.since,
    },
    {
      tags: {
        ...(options.tags || {}),
        request_shape: context.useDelta ? "delta" : "full",
      },
    },
  );
  syncProjectionTracker(tracker, response);
  return response;
}

export function callTrackedProjectionWithCursor(token, fn, body, tracker, options = {}) {
  const firstResponse = callTrackedProjection(token, fn, body, tracker, options);
  const nextCursor = readNextCursor(firstResponse);
  const appendEvery = tracker.appendEvery;
  const shouldAppend =
    appendEvery > 0 &&
    Boolean(nextCursor) &&
    (tracker.cycles === 1 || tracker.cycles % appendEvery === 0);
  if (!shouldAppend) {
    return { firstResponse, nextCursor, secondResponse: null };
  }
  const secondResponse = callRpc(
    token,
    fn,
    {
      ...(body || {}),
      cursor: nextCursor,
      delta_token: null,
      since: null,
    },
    {
      tags: {
        ...(options.tags || {}),
        page: "append",
        request_shape: "append",
      },
    },
  );
  return { firstResponse, nextCursor, secondResponse };
}

export function envFlag(name) {
  return (
    String(__ENV[name] || "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function rehearsalProfile() {
  const normalized = String(__ENV.K6_REHEARSAL_PROFILE || "gate")
    .trim()
    .toLowerCase();
  return normalized === "full" ? "full" : "gate";
}

export function readIntEnv(name, fallback) {
  const parsed = Number.parseInt(String(__ENV[name] || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readDurationEnv(name, fallback) {
  const value = String(__ENV[name] || "").trim();
  return value || fallback;
}

export function readJsonEnv(name, fallback) {
  const raw = String(__ENV[name] || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function randomQuery() {
  const samples = ["yazilim", "muzik", "ai", "kampus", "spor", "tasarim"];
  return samples[Math.floor(Math.random() * samples.length)];
}

export function getProjectionTargets() {
  return {
    targetClubId,
    targetEventCommentId,
    targetEventId,
    targetAlbumCommentId,
    targetNotificationId,
    targetPhotoId,
    targetProfileId,
    targetProfileUsername,
  };
}

export function callOptionalProjectionSet(token) {
  const targets = getProjectionTargets();

  if (targets.targetProfileUsername) {
    callRpc(token, "profile_overview_projection", {
      since: null,
      target_username: targets.targetProfileUsername,
      viewer_id: null,
    });
    callRpcWithCursor(
      token,
      "profile_content_projection",
      {
        cursor: null,
        limit_count: 20,
        since: null,
        tab_name: "events",
        target_username: targets.targetProfileUsername,
        viewer_id: null,
      },
      { append: true },
    );
  }

  if (targets.targetEventId) {
    callRpc(token, "event_detail_projection", {
      since: null,
      target_event_id: targets.targetEventId,
      viewer_id: null,
    });
    callRpc(token, "event_comments_projection", {
      cursor: null,
      limit_count: 20,
      since: null,
      target_event_id: targets.targetEventId,
      viewer_id: null,
    });
    callRpc(token, "event_likers_projection", {
      cursor: null,
      limit_count: 20,
      since: null,
      target_event_id: targets.targetEventId,
      viewer_id: null,
    });
    callRpc(token, "event_attendees_projection", {
      cursor: null,
      limit_count: 20,
      since: null,
      target_event_id: targets.targetEventId,
      viewer_id: null,
    });
    callRpcWithCursor(
      token,
      "album_event_projection",
      {
        cursor: null,
        limit_count: 20,
        since: null,
        target_event_id: targets.targetEventId,
        viewer_id: null,
      },
      { append: true },
    );
  }

  if (targets.targetPhotoId) {
    callRpc(token, "album_photo_likers_projection", {
      cursor: null,
      limit_count: 20,
      since: null,
      target_photo_id: targets.targetPhotoId,
      viewer_id: null,
    });
    callRpcWithCursor(
      token,
      "album_comments_projection",
      {
        cursor: null,
        limit_count: 20,
        photo_id: targets.targetPhotoId,
        since: null,
        viewer_id: null,
      },
      { append: true },
    );
  }

  if (targets.targetEventCommentId) {
    callRpc(token, "event_comment_likers_projection", {
      cursor: null,
      limit_count: 20,
      since: null,
      target_comment_id: targets.targetEventCommentId,
      viewer_id: null,
    });
  }

  if (targets.targetAlbumCommentId) {
    callRpc(token, "album_comment_likers_projection", {
      cursor: null,
      limit_count: 20,
      since: null,
      target_comment_id: targets.targetAlbumCommentId,
      viewer_id: null,
    });
  }
}

export function callOptionalMutationSet(token) {
  if (!envFlag("K6_ENABLE_MUTATIONS")) return;

  const targets = getProjectionTargets();
  if (targets.targetProfileId) {
    callRpc(token, "toggle_follow_with_patch", {
      target_user_id: targets.targetProfileId,
    });
  }
  if (targets.targetClubId) {
    callRpc(token, "toggle_club_membership_with_patch", {
      target_club_id: targets.targetClubId,
    });
  }
  if (targets.targetNotificationId) {
    callRpc(token, "mark_notification_read_with_patch", {
      target_notification_id: targets.targetNotificationId,
    });
  }
  if (targets.targetEventId) {
    callRpc(token, "toggle_event_like", {
      target_event_id: targets.targetEventId,
    });
    callRpc(token, "toggle_event_attendance", {
      target_event_id: targets.targetEventId,
    });
  }
}

export function idle(ms = 1) {
  sleep(ms);
}

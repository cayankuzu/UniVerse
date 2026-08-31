import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudflareOriginVerificationError,
  readCloudflareOriginVerificationConfig,
  resolveSelectedOriginRoute,
  verifyCloudflareOriginRequest,
} from "./cloudflareOriginVerification.ts";
import {
  markVerifiedClientNetworkKey,
  readVerifiedClientNetworkSubject,
} from "./verifiedClientNetwork.ts";

const SECRET = "origin-secret-that-is-at-least-32-bytes";
const NOW_SECONDS = 1_788_080_000;
const NONCE = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "request-1";
const CLIENT_NETWORK_KEY = "a".repeat(43);
const SIGNATURE_VERSION = "2";
const textEncoder = new TextEncoder();

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function toHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function canonicalizePublicPath(path) {
  const url = new URL(`https://edge.test${path}`);
  const sorted = [...url.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );
  const query = new URLSearchParams(sorted).toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

async function signRequest({
  body = "",
  clientNetworkKey = CLIENT_NETWORK_KEY,
  method = "POST",
  path = "/reports",
  signatureVersion = SIGNATURE_VERSION,
  timestamp = NOW_SECONDS,
}) {
  const bodyBytes = textEncoder.encode(body);
  const bodyHash = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bodyBytes)));
  const canonicalPath = canonicalizePublicPath(path);
  const canonical = [
    signatureVersion,
    String(timestamp),
    NONCE,
    method,
    canonicalPath,
    clientNetworkKey,
    bodyHash,
  ].join("\n");
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(SECRET),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = toBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(canonical))),
  );
  const headers = new Headers({
    "x-request-id": REQUEST_ID,
    "x-universe-edge-body-sha256": bodyHash,
    "x-universe-edge-canonical-path": canonicalPath,
    "x-universe-edge-client-network-key": clientNetworkKey,
    "x-universe-edge-nonce": NONCE,
    "x-universe-edge-signature": signature,
    "x-universe-edge-signature-version": signatureVersion,
    "x-universe-edge-timestamp": String(timestamp),
  });
  if (body) headers.set("content-type", "application/json");
  return new Request(`https://origin.test/server/make-server-e3557d40${path}`, {
    body: body || undefined,
    headers,
    method,
  });
}

function config(mode = "enforce") {
  return readCloudflareOriginVerificationConfig({ mode, secret: SECRET });
}

async function expectVerificationError(promise, expectedCode, expectedStatus) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CloudflareOriginVerificationError);
    assert.equal(error.code, expectedCode);
    assert.equal(error.status, expectedStatus);
    return true;
  });
}

test("route selection mirrors the gateway allowlist and excludes recovery surfaces", () => {
  assert.deepEqual(
    resolveSelectedOriginRoute(
      "https://origin.test/server/make-server-e3557d40/auth/check-email?email=a%40b.dev",
      "GET",
    ),
    {
      canonicalPath: "/auth/check-email?email=a%40b.dev",
      id: "auth.check-email",
      maxBodyBytes: 0,
    },
  );
  assert.equal(
    resolveSelectedOriginRoute(
      "https://origin.test/server/make-server-e3557d40/auth/recovery",
      "POST",
    ),
    null,
  );
  assert.equal(
    resolveSelectedOriginRoute(
      "https://origin.test/server/make-server-e3557d40/follows/status",
      "GET",
    ),
    null,
  );
});

test("configuration defaults off and fails closed for invalid active settings", () => {
  assert.equal(readCloudflareOriginVerificationConfig({}).mode, "off");
  assert.throws(
    () => readCloudflareOriginVerificationConfig({ mode: "enforce", secret: "weak" }),
    /at least 32/,
  );
  assert.throws(
    () => readCloudflareOriginVerificationConfig({ mode: "unexpected", secret: SECRET }),
    /Invalid mode/,
  );
});

test("off bypasses selected routes without touching replay storage", async () => {
  let claimCalls = 0;
  const result = await verifyCloudflareOriginRequest(
    new Request("https://origin.test/server/make-server-e3557d40/reports", { method: "POST" }),
    readCloudflareOriginVerificationConfig({}),
    { claimNonce: async () => (claimCalls += 1) > 0 },
  );
  assert.equal(result.outcome, "disabled");
  assert.equal(claimCalls, 0);
});

test("observe allows wholly unsigned traffic but rejects partial downgrade headers", async () => {
  const unsigned = new Request("https://origin.test/server/make-server-e3557d40/reports", {
    method: "POST",
  });
  const result = await verifyCloudflareOriginRequest(unsigned, config("observe"), {
    claimNonce: async () => true,
  });
  assert.equal(result.outcome, "observed_unsigned");

  const partial = new Request("https://origin.test/server/make-server-e3557d40/reports", {
    headers: { "x-universe-edge-nonce": NONCE },
    method: "POST",
  });
  await expectVerificationError(
    verifyCloudflareOriginRequest(partial, config("observe"), { claimNonce: async () => true }),
    "origin_signature_incomplete",
    401,
  );
});

test("enforce accepts the Worker v2 signature and returns its trusted network key", async () => {
  const body = JSON.stringify({ reason: "spam", targetId: "target-1", targetType: "event" });
  const request = await signRequest({ body });
  let capturedClaim;
  const result = await verifyCloudflareOriginRequest(request, config(), {
    claimNonce: async (claim) => {
      capturedClaim = claim;
      return true;
    },
    now: () => NOW_SECONDS * 1000,
  });
  assert.deepEqual(result, {
    clientNetworkKey: CLIENT_NETWORK_KEY,
    outcome: "verified",
    routeId: "reports.create",
  });
  assert.equal(capturedClaim.nonce, NONCE);
  assert.equal(capturedClaim.requestId, REQUEST_ID);
  assert.equal(capturedClaim.routeId, "reports.create");
  assert.deepEqual(await request.json(), JSON.parse(body));
});

test("signed traffic fails closed when its signature version is missing or unknown", async () => {
  const missingVersion = await signRequest({});
  missingVersion.headers.delete("x-universe-edge-signature-version");
  let claimCalls = 0;
  await expectVerificationError(
    verifyCloudflareOriginRequest(missingVersion, config(), {
      claimNonce: async () => (claimCalls += 1) > 0,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_signature_incomplete",
    401,
  );

  const unknownVersion = await signRequest({ signatureVersion: "3" });
  await expectVerificationError(
    verifyCloudflareOriginRequest(unknownVersion, config(), {
      claimNonce: async () => (claimCalls += 1) > 0,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_signature_invalid",
    401,
  );
  assert.equal(claimCalls, 0);
});

test("the request-local client network subject exists only after verified marking", () => {
  const request = new Request("https://origin.test/server/make-server-e3557d40/reports");
  assert.equal(readVerifiedClientNetworkSubject(request), "");
  assert.throws(
    () => markVerifiedClientNetworkKey(request, "forged"),
    /Invalid client network key/,
  );
  markVerifiedClientNetworkKey(request, CLIENT_NETWORK_KEY);
  assert.equal(readVerifiedClientNetworkSubject(request), `edge-network:${CLIENT_NETWORK_KEY}`);
});

test("enforce rejects a tampered client network key before claiming a nonce", async () => {
  const signed = await signRequest({});
  signed.headers.set("x-universe-edge-client-network-key", "b".repeat(43));
  let claimCalls = 0;
  await expectVerificationError(
    verifyCloudflareOriginRequest(signed, config(), {
      claimNonce: async () => (claimCalls += 1) > 0,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_signature_invalid",
    401,
  );
  assert.equal(claimCalls, 0);
});

test("enforce rejects body tampering before claiming a nonce", async () => {
  const signed = await signRequest({ body: JSON.stringify({ reason: "spam" }) });
  const tampered = new Request(signed.url, {
    body: JSON.stringify({ reason: "different" }),
    headers: signed.headers,
    method: signed.method,
  });
  let claimCalls = 0;
  await expectVerificationError(
    verifyCloudflareOriginRequest(tampered, config(), {
      claimNonce: async () => (claimCalls += 1) > 0,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_body_hash_invalid",
    401,
  );
  assert.equal(claimCalls, 0);
});

test("enforce rejects stale signatures and replayed nonces", async () => {
  const stale = await signRequest({ timestamp: NOW_SECONDS - 121 });
  await expectVerificationError(
    verifyCloudflareOriginRequest(stale, config(), {
      claimNonce: async () => true,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_timestamp_invalid",
    401,
  );

  const replay = await signRequest({});
  await expectVerificationError(
    verifyCloudflareOriginRequest(replay, config(), {
      claimNonce: async () => false,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_request_replayed",
    409,
  );
});

test("body limits and replay-store outages fail closed", async () => {
  const oversizedBody = JSON.stringify({ reason: "x".repeat(4200) });
  const oversized = await signRequest({ body: oversizedBody });
  await expectVerificationError(
    verifyCloudflareOriginRequest(oversized, config(), {
      claimNonce: async () => true,
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_body_too_large",
    413,
  );

  const signed = await signRequest({});
  await expectVerificationError(
    verifyCloudflareOriginRequest(signed, config(), {
      claimNonce: async () => {
        throw new Error("database unavailable");
      },
      now: () => NOW_SECONDS * 1000,
    }),
    "origin_nonce_store_unavailable",
    503,
  );
});

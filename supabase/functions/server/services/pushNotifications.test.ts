import assert from "node:assert/strict";
import {
  sendExpoPushBatch,
  sendExpoPushBatchesByProject,
  type ExpoProjectPushMessage,
} from "./pushNotifications.ts";

function message(to: string) {
  return {
    body: "Yeni bir bildirimin var.",
    data: { notificationId: "00000000-0000-4000-8000-000000000001" },
    title: "UniVerse",
    to,
  };
}

Deno.test("mixed project outcomes retain transport metadata on their own tickets", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const messages = JSON.parse(String(init?.body || "[]")) as Array<{ to?: string }>;
    if (messages[0]?.to?.includes("network-group")) {
      throw new TypeError("network unavailable");
    }
    return new Response(
      JSON.stringify({ errors: [{ code: "TOO_MANY_REQUESTS", message: "rate limited" }] }),
      { headers: { "content-type": "application/json", "retry-after": "17" }, status: 429 },
    );
  }) as typeof fetch;

  try {
    const entries: ExpoProjectPushMessage[] = [
      {
        message: message("ExponentPushToken[network-group]"),
        projectId: "00000000-0000-4000-8000-000000000001",
      },
      {
        message: message("ExponentPushToken[http-group]"),
        projectId: "00000000-0000-4000-8000-000000000002",
      },
    ];
    const result = await sendExpoPushBatchesByProject(entries);

    assert.equal(result.tickets[0]?.transportError, "provider-network-error:network unavailable");
    assert.equal(result.tickets[0]?.transportStatus, undefined);
    assert.equal(result.tickets[0]?.retryAfterSeconds, undefined);
    assert.equal(result.tickets[1]?.transportError, "http-429");
    assert.equal(result.tickets[1]?.transportStatus, 429);
    assert.equal(result.tickets[1]?.retryAfterSeconds, 17);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Expo ok response without a nonempty ticket id fails closed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ data: [{ status: "ok" }] }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })) as typeof fetch;

  try {
    const result = await sendExpoPushBatch([message("ExponentPushToken[missing-ticket-id]")]);

    assert.deepEqual(result.tickets[0], {
      errorCode: "MalformedExpoTicket",
      message: "expo-ok-ticket-missing-id",
      status: "error",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

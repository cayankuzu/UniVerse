import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from "jose";
import { describe, expect, it, vi } from "vitest";
import {
  buildRateLimitKey,
  canonicalizePath,
  signOriginRequest,
  verifyAsymmetricSupabaseJwt,
  verifyLegacySupabaseJwt,
} from "../src/security";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const ISSUER = "https://project.supabase.co/auth/v1";
const CONFIG = {
  audience: "authenticated",
  issuer: ISSUER,
  publishableKey: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  supabaseUrl: "https://project.supabase.co",
};

function validClaims(nowSeconds: number): JWTPayload {
  return {
    aud: "authenticated",
    exp: nowSeconds + 300,
    iat: nowSeconds,
    iss: ISSUER,
    role: "authenticated",
    sub: SUBJECT,
  };
}

async function asymmetricFixture(kid = "test-key") {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = "ES256";
  publicJwk.kid = kid;
  const token = await new SignJWT(validClaims(nowSeconds))
    .setProtectedHeader({ alg: "ES256", kid })
    .sign(privateKey);
  return { publicJwk, token };
}

describe("edge security primitives", () => {
  it("canonicalizes query ordering without losing duplicate values", () => {
    expect(
      canonicalizePath(new URL("https://edge.test/auth/check-email?z=2&email=b%40x.dev&z=1")),
    ).toBe("/auth/check-email?email=b%40x.dev&z=1&z=2");
  });

  it("produces deterministic HMAC signatures over path and body", async () => {
    const input = {
      body: new TextEncoder().encode('{"sessionId":"abc"}'),
      canonicalPath: "/storage/upload-session/finalize",
      clientNetworkKey: "a".repeat(43),
      method: "POST",
      nonce: "22222222-2222-4222-8222-222222222222",
      secret: "origin-secret-that-is-at-least-32-bytes",
      timestamp: "1788080000",
    };
    const first = await signOriginRequest(input);
    const second = await signOriginRequest(input);
    expect(first).toEqual(second);
    expect(first.bodyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.signatureVersion).toBe("2");
    expect((await signOriginRequest({ ...input, canonicalPath: "/reports" })).signature).not.toBe(
      first.signature,
    );
    expect(
      (await signOriginRequest({ ...input, clientNetworkKey: "b".repeat(43) })).signature,
    ).not.toBe(first.signature);
  });

  it("hashes rate-limit identifiers with an environment salt", async () => {
    const first = await buildRateLimitKey("salt-that-is-at-least-thirty-two-bytes", [
      "production",
      "reports.create",
      SUBJECT,
    ]);
    const second = await buildRateLimitKey("different-salt-that-is-at-least-32", [
      "production",
      "reports.create",
      SUBJECT,
    ]);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain(SUBJECT);
  });

  it("verifies an asymmetric signature plus issuer, audience, time and subject", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.alg = "ES256";
    publicJwk.kid = "test-key";
    const token = await new SignJWT(validClaims(nowSeconds))
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .sign(privateKey);
    await expect(
      verifyAsymmetricSupabaseJwt(token, CONFIG, createLocalJWKSet({ keys: [publicJwk] })),
    ).resolves.toEqual({ subject: SUBJECT });
  });

  it("rejects a valid signature carrying the wrong audience", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.alg = "ES256";
    publicJwk.kid = "test-key";
    const token = await new SignJWT({ ...validClaims(nowSeconds), aud: "anon" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .sign(privateKey);
    await expect(
      verifyAsymmetricSupabaseJwt(token, CONFIG, createLocalJWKSet({ keys: [publicJwk] })),
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 });
  });

  it("rejects expired and not-before tokens", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.alg = "ES256";
    publicJwk.kid = "test-key";
    const keySet = createLocalJWKSet({ keys: [publicJwk] });
    const expired = await new SignJWT({ ...validClaims(nowSeconds), exp: nowSeconds - 30 })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .sign(privateKey);
    const future = await new SignJWT({ ...validClaims(nowSeconds), nbf: nowSeconds + 60 })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .sign(privateKey);
    await expect(verifyAsymmetricSupabaseJwt(expired, CONFIG, keySet)).rejects.toMatchObject({
      status: 401,
    });
    await expect(verifyAsymmetricSupabaseJwt(future, CONFIG, keySet)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("caches remote JWKS independently per fetcher and URL", async () => {
    const { publicJwk, token } = await asymmetricFixture("cached-key");
    const firstFetcher: typeof fetch = vi.fn(async () => Response.json({ keys: [publicJwk] }));
    const secondFetcher: typeof fetch = vi.fn(async () => Response.json({ keys: [publicJwk] }));

    await expect(
      verifyAsymmetricSupabaseJwt(token, CONFIG, undefined, firstFetcher),
    ).resolves.toEqual({ subject: SUBJECT });
    await expect(
      verifyAsymmetricSupabaseJwt(token, CONFIG, undefined, firstFetcher),
    ).resolves.toEqual({ subject: SUBJECT });
    expect(firstFetcher).toHaveBeenCalledTimes(1);

    await expect(
      verifyAsymmetricSupabaseJwt(token, CONFIG, undefined, secondFetcher),
    ).resolves.toEqual({ subject: SUBJECT });
    expect(secondFetcher).toHaveBeenCalledTimes(1);

    await expect(
      verifyAsymmetricSupabaseJwt(
        token,
        { ...CONFIG, supabaseUrl: "https://another-project.supabase.co" },
        undefined,
        firstFetcher,
      ),
    ).resolves.toEqual({ subject: SUBJECT });
    expect(firstFetcher).toHaveBeenCalledTimes(2);
  });

  it("returns auth_unavailable for remote JWKS outages but 401 for invalid signatures", async () => {
    const trusted = await asymmetricFixture("shared-key");
    const attacker = await asymmetricFixture("shared-key");
    const unavailableFetcher: typeof fetch = vi.fn(async () =>
      Response.json({ error: "unavailable" }, { status: 503 }),
    );
    await expect(
      verifyAsymmetricSupabaseJwt(trusted.token, CONFIG, undefined, unavailableFetcher),
    ).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });

    const malformedFetcher: typeof fetch = vi.fn(async () =>
      Response.json({ keys: "not-an-array" }),
    );
    await expect(
      verifyAsymmetricSupabaseJwt(trusted.token, CONFIG, undefined, malformedFetcher),
    ).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });

    const trustedFetcher: typeof fetch = vi.fn(async () =>
      Response.json({ keys: [trusted.publicJwk] }),
    );
    await expect(
      verifyAsymmetricSupabaseJwt(attacker.token, CONFIG, undefined, trustedFetcher),
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 });
  });

  it("bounds remote JWKS bodies and fails closed on oversized responses", async () => {
    const trusted = await asymmetricFixture("oversized-key");
    const oversizedFetcher: typeof fetch = vi.fn(
      async () =>
        new Response("x".repeat(65_537), {
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      verifyAsymmetricSupabaseJwt(trusted.token, CONFIG, undefined, oversizedFetcher),
    ).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });
  });

  it("validates legacy HS256 tokens through the Supabase Auth server", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secret = new TextEncoder().encode("legacy-test-signing-secret-with-32-bytes");
    const token = await new SignJWT(validClaims(nowSeconds))
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    const fetcher: typeof fetch = vi.fn(async () =>
      Response.json({ id: SUBJECT }, { headers: { "content-length": "45" } }),
    );
    await expect(verifyLegacySupabaseJwt(token, CONFIG, fetcher)).resolves.toEqual({
      subject: SUBJECT,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/user",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: `Bearer ${token}` }),
      }),
    );
  });

  it("rejects a legacy token when Auth returns a different user", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secret = new TextEncoder().encode("legacy-test-signing-secret-with-32-bytes");
    const token = await new SignJWT(validClaims(nowSeconds))
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    const fetcher: typeof fetch = vi.fn(async () =>
      Response.json(
        { id: "33333333-3333-4333-8333-333333333333" },
        { headers: { "content-length": "45" } },
      ),
    );
    await expect(verifyLegacySupabaseJwt(token, CONFIG, fetcher)).rejects.toMatchObject({
      code: "invalid_token_subject",
      status: 401,
    });
  });

  it("maps oversized legacy Auth bodies to provider unavailability", async () => {
    const oversizedFetcher: typeof fetch = vi.fn(
      async () =>
        new Response("x".repeat(65_537), {
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      verifyLegacySupabaseJwt("opaque-token", CONFIG, oversizedFetcher),
    ).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });
  });

  it("distinguishes invalid legacy credentials from Auth provider outages", async () => {
    const invalidFetcher: typeof fetch = vi.fn(async () =>
      Response.json({ error: "invalid" }, { status: 401 }),
    );
    await expect(
      verifyLegacySupabaseJwt("invalid-token", CONFIG, invalidFetcher),
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 });

    for (const status of [429, 500, 503]) {
      const unavailableFetcher: typeof fetch = vi.fn(async () =>
        Response.json({ error: "unavailable" }, { status }),
      );
      await expect(
        verifyLegacySupabaseJwt("opaque-token", CONFIG, unavailableFetcher),
      ).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });
    }

    const transportFailure: typeof fetch = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    await expect(
      verifyLegacySupabaseJwt("opaque-token", CONFIG, transportFailure),
    ).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });
  });
});

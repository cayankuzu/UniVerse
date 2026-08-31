import type { ZodType } from "zod";
import { GatewayError } from "./errors";

const textEncoder = new TextEncoder();

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new GatewayError("body_too_large", 413, "İstek gövdesi çok büyük.");
  }

  if (!request.body) return new Uint8Array();
  if (maxBytes === 0) {
    throw new GatewayError("body_not_allowed", 400, "Bu istek gövde kabul etmiyor.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let streamComplete = false;
  try {
    while (!streamComplete) {
      const { done, value } = await reader.read();
      streamComplete = done;
      if (streamComplete) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body limit exceeded");
        throw new GatewayError("body_too_large", 413, "İstek gövdesi çok büyük.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function parseAndNormalizeJsonBody(
  request: Request,
  body: Uint8Array,
  schema: ZodType,
): { normalizedBody: Uint8Array; parsedBody: unknown } {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new GatewayError("unsupported_media_type", 415, "Content-Type application/json olmalı.");
  }
  if (body.byteLength === 0) {
    throw new GatewayError("invalid_body", 400, "İstek gövdesi gerekli.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new GatewayError("invalid_json", 400, "Geçersiz JSON gövdesi.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new GatewayError("invalid_body", 400, "İstek şeması geçersiz.");
  }
  return {
    normalizedBody: textEncoder.encode(JSON.stringify(result.data)),
    parsedBody: result.data,
  };
}

export async function readBoundedResponseJson(
  response: Response,
  maxBytes = 65_536,
): Promise<unknown> {
  const clone = response.clone();
  const bytes = await readBoundedRequestBody(
    new Request("https://response.invalid", {
      body: clone.body,
      headers: clone.headers,
      method: "POST",
    }),
    maxBytes,
  );
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new GatewayError("invalid_auth_response", 503, "Kimlik doğrulama kullanılamıyor.");
  }
}

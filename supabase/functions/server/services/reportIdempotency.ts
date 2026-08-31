const textEncoder = new TextEncoder();

export type ReportIdempotencyPayload = {
  detail?: string;
  reason: string;
  targetId: string;
  targetType: string;
  targetUsername?: string;
};

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintReportMutation(payload: ReportIdempotencyPayload) {
  const canonical = JSON.stringify({
    detail: String(payload.detail || "").trim(),
    reason: String(payload.reason || "").trim(),
    targetId: String(payload.targetId || "").trim(),
    targetType: String(payload.targetType || "").trim(),
    targetUsername: String(payload.targetUsername || "")
      .trim()
      .toLowerCase(),
  });
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(canonical));
  return toHex(new Uint8Array(digest));
}

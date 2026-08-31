const CLIENT_NETWORK_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const verifiedClientNetworkKeys = new WeakMap<Request, string>();

export function markVerifiedClientNetworkKey(request: Request, clientNetworkKey: string) {
  const normalized = String(clientNetworkKey || "").trim();
  if (!CLIENT_NETWORK_KEY_PATTERN.test(normalized)) {
    throw new Error("[verified-client-network] Invalid client network key.");
  }
  verifiedClientNetworkKeys.set(request, normalized);
}

export function readVerifiedClientNetworkSubject(request: Request | undefined) {
  if (!request) return "";
  const clientNetworkKey = verifiedClientNetworkKeys.get(request);
  return clientNetworkKey ? `edge-network:${clientNetworkKey}` : "";
}

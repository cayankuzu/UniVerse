export interface ClientMutationOptions {
  clientMutationId?: string | null;
}

function randomMutationSeed() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const raw = Math.floor(Math.random() * 16);
    const value = char === "x" ? raw : (raw & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function normalizeClientMutationId(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .slice(0, 120);
  return normalized || null;
}

export function createClientMutationId(scope: string) {
  const normalizedScope =
    String(scope || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9:-]+/g, "-")
      .slice(0, 48) || "mutation";
  return `${normalizedScope}:${randomMutationSeed()}`;
}

export function withClientMutationId<T extends Record<string, unknown>>(
  params: T,
  options?: ClientMutationOptions | null,
) {
  const clientMutationId = normalizeClientMutationId(options?.clientMutationId);
  if (!clientMutationId) return params;
  return {
    ...params,
    client_mutation_id: clientMutationId,
  };
}

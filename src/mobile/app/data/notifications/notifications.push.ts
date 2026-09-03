import type { SuccessResponse } from "../contracts/api";
import * as Crypto from "expo-crypto";
import { post } from "../../platform/api/core";
import {
  readSecureJson,
  removeSecurePersistedValue,
  writeSecureJson,
} from "../../platform/storage/securePersist";

export type PushPlatform = "android" | "ios";
export type PushAppEnv = "development" | "preview" | "production";

export type PushRegistrationContext = {
  appEnv: PushAppEnv;
  expoProjectId?: string;
  platform: PushPlatform;
};

export type StoredPushRegistration = PushRegistrationContext & {
  expoPushToken: string;
  generation: number;
  installationId: string;
  registrationId?: string;
  userId: string;
};

export type PushGenerationReservation = PushRegistrationContext & {
  generation: number;
  installationId: string;
};

export type PushMutationResponse = SuccessResponse & {
  applied?: boolean;
  currentGeneration?: number;
};

export type PushUnregisterCleanupReason =
  "storage-clear-failed" | "storage-read-failed" | "unregister-failed" | "unregister-unconfirmed";

export type PushUnregisterCleanupResult =
  | { status: "cleared" | "missing" | "superseded" }
  | {
      error?: unknown;
      reason: PushUnregisterCleanupReason;
      status: "retained";
    };

type RegisterPushTokenPayload = PushGenerationReservation & {
  expoProjectId: string;
  expoPushToken: string;
};

type StoredPushInstallation = {
  generation: number;
  installationId: string;
  lastContext?: PushRegistrationContext;
};

type LegacyStoredPushRegistration = PushRegistrationContext & {
  expoPushToken: string;
  userId: string;
};

type PushRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const PUSH_REGISTRATION_STORAGE_KEY = "app:push-registration";
const PUSH_INSTALLATION_STORAGE_KEY = "app:push-installation:v1";
const PUSH_INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createSerializedStorageOperation() {
  let tail: Promise<void> = Promise.resolve();
  return <T>(operation: () => Promise<T>) => {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

// The counter and the local registration record share one queue. Reserving generation N+1
// therefore happens-before any stale generation N attempt can persist itself locally.
const runPushStorageOperation = createSerializedStorageOperation();

function normalizePushInstallationId(value: unknown) {
  const normalized = String(value || "").trim();
  return PUSH_INSTALLATION_ID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizePushGeneration(value: unknown, allowZero = false) {
  const generation = Number(value);
  const minimum = allowZero ? 0 : 1;
  return Number.isSafeInteger(generation) && generation >= minimum ? generation : null;
}

function normalizePushMutationResponse(value: unknown): Required<PushMutationResponse> | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const currentGeneration = Number(item.currentGeneration);
  if (
    item.success !== true ||
    typeof item.applied !== "boolean" ||
    !Number.isSafeInteger(currentGeneration) ||
    currentGeneration < 0
  ) {
    return null;
  }
  return { applied: item.applied, currentGeneration, success: true };
}

function normalizeConfirmedPushMutationResponse(
  value: unknown,
  minimumGeneration: number,
): Required<PushMutationResponse> | null {
  const normalized = normalizePushMutationResponse(value);
  return normalized?.applied === true && normalized.currentGeneration >= minimumGeneration
    ? normalized
    : null;
}

function normalizePushContext(value: unknown): PushRegistrationContext | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const appEnv =
    item.appEnv === "development" || item.appEnv === "preview" || item.appEnv === "production"
      ? item.appEnv
      : null;
  const platform = item.platform === "android" || item.platform === "ios" ? item.platform : null;
  const expoProjectId = String(item.expoProjectId || "").trim();
  if (!appEnv || !platform) return null;
  return { appEnv, ...(expoProjectId ? { expoProjectId } : {}), platform };
}

function createOpaquePushIdentifier() {
  const randomUuid = Crypto.randomUUID();
  if (randomUuid && normalizePushInstallationId(randomUuid)) return randomUuid.toLowerCase();
  throw new Error("Secure push installation identity generation failed.");
}

function normalizeStoredPushRegistration(value: unknown): StoredPushRegistration | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const context = normalizePushContext(item);
  const expoPushToken = String(item.expoPushToken || "").trim();
  const generation = normalizePushGeneration(item.generation);
  const installationId = normalizePushInstallationId(item.installationId);
  const registrationId = normalizePushInstallationId(item.registrationId);
  const userId = String(item.userId || "").trim();
  if (!context || !expoPushToken || !generation || !installationId || !userId) return null;
  return {
    ...context,
    expoPushToken,
    generation,
    installationId,
    ...(registrationId ? { registrationId } : {}),
    userId,
  };
}

function normalizeLegacyStoredPushRegistration(
  value: unknown,
): LegacyStoredPushRegistration | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const context = normalizePushContext(item);
  const expoPushToken = String(item.expoPushToken || "").trim();
  const userId = String(item.userId || "").trim();
  if (!context || !expoPushToken || !userId) return null;
  return { ...context, expoPushToken, userId };
}

function normalizeStoredPushInstallation(value: unknown): StoredPushInstallation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const installationId = normalizePushInstallationId(item.installationId);
  if (!installationId) return null;
  return {
    generation: normalizePushGeneration(item.generation, true) || 0,
    installationId,
    ...(normalizePushContext(item.lastContext)
      ? { lastContext: normalizePushContext(item.lastContext) || undefined }
      : {}),
  };
}

async function readStoredPushRegistrationValueUnsafe() {
  return readSecureJson<unknown>(PUSH_REGISTRATION_STORAGE_KEY);
}

async function readStoredPushRegistrationUnsafe() {
  return normalizeStoredPushRegistration(await readStoredPushRegistrationValueUnsafe());
}

async function readStoredPushInstallationUnsafe() {
  return normalizeStoredPushInstallation(
    await readSecureJson<StoredPushInstallation>(PUSH_INSTALLATION_STORAGE_KEY),
  );
}

async function ensureStoredPushInstallationUnsafe(): Promise<StoredPushInstallation> {
  const stored = await readStoredPushInstallationUnsafe();
  if (stored) return stored;
  const next = { generation: 0, installationId: createOpaquePushIdentifier() };
  await writeSecureJson(PUSH_INSTALLATION_STORAGE_KEY, next);
  return next;
}

async function getPushInstallationId() {
  return runPushStorageOperation(
    async () => (await ensureStoredPushInstallationUnsafe()).installationId,
  );
}

async function reservePushGeneration(context: PushRegistrationContext) {
  return runPushStorageOperation(async (): Promise<PushGenerationReservation> => {
    const stored = await ensureStoredPushInstallationUnsafe();
    const generation = stored.generation + 1;
    if (!Number.isSafeInteger(generation))
      throw new Error("Push installation generation exhausted.");
    const next = { generation, installationId: stored.installationId, lastContext: context };
    await writeSecureJson(PUSH_INSTALLATION_STORAGE_KEY, next);
    return { ...context, generation, installationId: stored.installationId };
  });
}

async function isPushGenerationCurrent(reservation: {
  generation: number;
  installationId: string;
}) {
  return runPushStorageOperation(async () => {
    const stored = await readStoredPushInstallationUnsafe();
    return (
      stored?.installationId === reservation.installationId &&
      stored.generation === reservation.generation
    );
  });
}

async function observeServerPushGeneration(installationId: string, value: unknown) {
  const serverGeneration = normalizePushGeneration(value, true);
  if (serverGeneration === null) return;
  await runPushStorageOperation(async () => {
    const stored = await readStoredPushInstallationUnsafe();
    if (
      !stored ||
      stored.installationId !== installationId ||
      serverGeneration <= stored.generation
    )
      return;
    await writeSecureJson(PUSH_INSTALLATION_STORAGE_KEY, {
      ...stored,
      generation: serverGeneration,
    });
  });
}

async function readStoredPushRegistration() {
  return runPushStorageOperation(readStoredPushRegistrationUnsafe);
}

async function rememberPushRegistration(value: StoredPushRegistration) {
  return runPushStorageOperation(async () => {
    const installation = await readStoredPushInstallationUnsafe();
    if (
      installation?.installationId !== value.installationId ||
      installation.generation !== value.generation
    ) {
      return false;
    }
    await writeSecureJson(PUSH_REGISTRATION_STORAGE_KEY, {
      ...value,
      registrationId: createOpaquePushIdentifier(),
    } satisfies StoredPushRegistration);
    return true;
  });
}

async function clearStoredPushRegistration() {
  return runPushStorageOperation(async () => {
    await removeSecurePersistedValue(PUSH_REGISTRATION_STORAGE_KEY);
  });
}

function isSameStoredPushRegistration(
  current: StoredPushRegistration,
  expected: StoredPushRegistration,
) {
  const currentRevision = normalizePushInstallationId(current.registrationId);
  const expectedRevision = normalizePushInstallationId(expected.registrationId);
  if (currentRevision || expectedRevision) return currentRevision === expectedRevision;
  return (
    current.installationId === expected.installationId &&
    current.generation === expected.generation &&
    current.expoPushToken === expected.expoPushToken &&
    current.userId === expected.userId
  );
}

function isSameLegacyStoredPushRegistration(
  current: LegacyStoredPushRegistration,
  expected: LegacyStoredPushRegistration,
) {
  return (
    current.appEnv === expected.appEnv &&
    current.expoProjectId === expected.expoProjectId &&
    current.expoPushToken === expected.expoPushToken &&
    current.platform === expected.platform &&
    current.userId === expected.userId
  );
}

async function preparePushTombstone() {
  return runPushStorageOperation(async () => {
    const storedRegistrationValue = await readStoredPushRegistrationValueUnsafe();
    const registration = normalizeStoredPushRegistration(storedRegistrationValue);
    const legacyRegistration = registration
      ? null
      : normalizeLegacyStoredPushRegistration(storedRegistrationValue);
    if (legacyRegistration) {
      return { legacyRegistration, registration: null, reservation: null };
    }
    const installation = await ensureStoredPushInstallationUnsafe();
    const context = normalizePushContext(registration) || installation.lastContext;
    if (!context) return { legacyRegistration: null, registration, reservation: null };
    const generation = installation.generation + 1;
    if (!Number.isSafeInteger(generation))
      throw new Error("Push installation generation exhausted.");
    const next = { generation, installationId: installation.installationId, lastContext: context };
    await writeSecureJson(PUSH_INSTALLATION_STORAGE_KEY, next);
    return {
      legacyRegistration: null,
      registration,
      reservation: { ...context, generation, installationId: installation.installationId },
    };
  });
}

async function finalizeLegacyPushUnregister(expected: LegacyStoredPushRegistration) {
  return runPushStorageOperation(async () => {
    const current = normalizeLegacyStoredPushRegistration(
      await readStoredPushRegistrationValueUnsafe(),
    );
    if (!current || !isSameLegacyStoredPushRegistration(current, expected)) {
      return "superseded" as const;
    }
    await removeSecurePersistedValue(PUSH_REGISTRATION_STORAGE_KEY);
    return "cleared" as const;
  });
}

async function finalizePushTombstone(
  expected: StoredPushRegistration | null,
  reservation: PushGenerationReservation,
  serverGeneration: unknown,
) {
  return runPushStorageOperation(async () => {
    const installation = await readStoredPushInstallationUnsafe();
    const observedGeneration = normalizePushGeneration(serverGeneration, true);
    if (
      installation?.installationId === reservation.installationId &&
      observedGeneration !== null &&
      observedGeneration > installation.generation
    ) {
      await writeSecureJson(PUSH_INSTALLATION_STORAGE_KEY, {
        ...installation,
        generation: observedGeneration,
      });
    }
    if (!expected) return "missing" as const;
    const current = await readStoredPushRegistrationUnsafe();
    if (!current || !isSameStoredPushRegistration(current, expected)) return "superseded" as const;
    await removeSecurePersistedValue(PUSH_REGISTRATION_STORAGE_KEY);
    return "cleared" as const;
  });
}

export const NotificationPushAPI = {
  clearStoredRegistration: clearStoredPushRegistration,
  getInstallationId: getPushInstallationId,
  getStoredRegistration: readStoredPushRegistration,
  isGenerationCurrent: isPushGenerationCurrent,
  observeServerGeneration: observeServerPushGeneration,
  normalizeMutationResponse: normalizePushMutationResponse,
  requireConfirmedMutation: normalizeConfirmedPushMutationResponse,
  registerToken: (payload: RegisterPushTokenPayload, options?: PushRequestOptions) =>
    post<PushMutationResponse>("/push/register", payload, options),
  rememberRegistration: rememberPushRegistration,
  reserveGeneration: reservePushGeneration,
  unregisterToken: (
    payload: PushGenerationReservation & { expoPushToken?: string },
    options?: PushRequestOptions,
  ) => post<PushMutationResponse>("/push/unregister", payload, options),
};

export async function bestEffortUnregisterStoredPushToken(
  options?: PushRequestOptions,
): Promise<PushUnregisterCleanupResult> {
  let prepared: Awaited<ReturnType<typeof preparePushTombstone>>;
  try {
    prepared = await preparePushTombstone();
  } catch (error) {
    return { error, reason: "storage-read-failed", status: "retained" };
  }
  if (prepared.legacyRegistration) {
    try {
      const response = await post<PushMutationResponse>(
        "/push/unregister",
        { expoPushToken: prepared.legacyRegistration.expoPushToken },
        options,
      );
      const confirmedResponse = NotificationPushAPI.requireConfirmedMutation(response, 0);
      if (!confirmedResponse) {
        return { reason: "unregister-unconfirmed", status: "retained" };
      }
    } catch (error) {
      return { error, reason: "unregister-failed", status: "retained" };
    }
    try {
      const status = await finalizeLegacyPushUnregister(prepared.legacyRegistration);
      return { status };
    } catch (error) {
      return { error, reason: "storage-clear-failed", status: "retained" };
    }
  }
  if (!prepared.reservation) return { status: "missing" };

  let response: PushMutationResponse;
  try {
    response = await NotificationPushAPI.unregisterToken(
      {
        ...prepared.reservation,
        ...(prepared.registration?.expoPushToken
          ? { expoPushToken: prepared.registration.expoPushToken }
          : {}),
      },
      options,
    );
    const normalizedResponse = NotificationPushAPI.normalizeMutationResponse(response);
    if (!normalizedResponse) {
      return { reason: "unregister-unconfirmed", status: "retained" };
    }
    await NotificationPushAPI.observeServerGeneration(
      prepared.reservation.installationId,
      normalizedResponse.currentGeneration,
    );
    const confirmedResponse = NotificationPushAPI.requireConfirmedMutation(
      normalizedResponse,
      prepared.reservation.generation,
    );
    if (!confirmedResponse) {
      return { reason: "unregister-unconfirmed", status: "retained" };
    }
    response = confirmedResponse;
  } catch (error) {
    return { error, reason: "unregister-failed", status: "retained" };
  }

  try {
    const status = await finalizePushTombstone(
      prepared.registration,
      prepared.reservation,
      response.currentGeneration,
    );
    return { status };
  } catch (error) {
    return { error, reason: "storage-clear-failed", status: "retained" };
  }
}

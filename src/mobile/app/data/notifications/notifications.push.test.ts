const mockPost = jest.fn();
const mockReadSecureJson = jest.fn();
const mockRemoveSecurePersistedValue = jest.fn();
const mockWriteSecureJson = jest.fn();
const mockRandomUUID = jest.fn();

jest.mock("expo-crypto", () => ({
  randomUUID: () => mockRandomUUID(),
}));

jest.mock("../../platform/api/core", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("../../platform/storage/securePersist", () => ({
  readSecureJson: (...args: unknown[]) => mockReadSecureJson(...args),
  removeSecurePersistedValue: (...args: unknown[]) => mockRemoveSecurePersistedValue(...args),
  writeSecureJson: (...args: unknown[]) => mockWriteSecureJson(...args),
}));

import { bestEffortUnregisterStoredPushToken, NotificationPushAPI } from "./notifications.push";

const INSTALLATION_ID = "8fdbe8a2-34c9-4d18-8821-0c36a2fb67d5";
const CONTEXT = {
  appEnv: "production" as const,
  expoProjectId: "2c93a7f8-6df2-4d91-89b8-8f1d8d4642a0",
  platform: "android" as const,
};
const STORED_REGISTRATION = {
  ...CONTEXT,
  expoPushToken: "ExponentPushToken[push-token-a]",
  generation: 1,
  installationId: INSTALLATION_ID,
  userId: "user-1",
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function flushAsyncWork() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("NotificationPushAPI", () => {
  let secureValues: Map<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomUUID.mockReturnValue("ea78e485-ce3e-4b46-9134-2f91f7805899");
    secureValues = new Map();
    mockReadSecureJson.mockImplementation(async (key: string) => secureValues.get(key) ?? null);
    mockRemoveSecurePersistedValue.mockImplementation(async (key: string) => {
      secureValues.delete(key);
    });
    mockWriteSecureJson.mockImplementation(async (key: string, value: unknown) => {
      secureValues.set(key, value);
    });
    mockPost.mockImplementation(async (_path: string, body: { generation?: number }) => ({
      applied: true,
      currentGeneration: body.generation || 0,
      success: true,
    }));
  });

  function seedRegistration() {
    secureValues.set("app:push-registration", STORED_REGISTRATION);
    secureValues.set("app:push-installation:v1", {
      generation: 1,
      installationId: INSTALLATION_ID,
      lastContext: CONTEXT,
    });
  }

  it("registers the stable installation generation with the existing endpoint", async () => {
    const payload = {
      ...CONTEXT,
      expoPushToken: STORED_REGISTRATION.expoPushToken,
      generation: 2,
      installationId: INSTALLATION_ID,
    };

    await NotificationPushAPI.registerToken(payload);

    expect(mockPost).toHaveBeenCalledWith("/push/register", payload, undefined);
  });

  it("accepts only explicit successful mutation confirmation at the reserved generation", () => {
    expect(
      NotificationPushAPI.normalizeMutationResponse({
        applied: false,
        currentGeneration: 10,
        success: true,
      }),
    ).toEqual({ applied: false, currentGeneration: 10, success: true });
    expect(
      NotificationPushAPI.requireConfirmedMutation(
        { applied: true, currentGeneration: 4, success: true },
        4,
      ),
    ).toEqual({ applied: true, currentGeneration: 4, success: true });
    expect(
      NotificationPushAPI.requireConfirmedMutation({ currentGeneration: 4, success: true }, 4),
    ).toBeNull();
    expect(
      NotificationPushAPI.requireConfirmedMutation(
        { applied: true, currentGeneration: 3, success: true },
        4,
      ),
    ).toBeNull();
    expect(
      NotificationPushAPI.requireConfirmedMutation(
        { applied: true, currentGeneration: Number.NaN, success: true },
        4,
      ),
    ).toBeNull();
  });

  it("keeps a valid persisted installation identity and generation", async () => {
    secureValues.set("app:push-installation:v1", {
      generation: 7,
      installationId: INSTALLATION_ID.toUpperCase(),
    });

    await expect(NotificationPushAPI.getInstallationId()).resolves.toBe(INSTALLATION_ID);
    expect(mockWriteSecureJson).not.toHaveBeenCalled();
  });

  it("creates and persists a UUID installation identity with generation zero", async () => {
    const installationId = await NotificationPushAPI.getInstallationId();

    expect(installationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(mockWriteSecureJson).toHaveBeenCalledWith("app:push-installation:v1", {
      generation: 0,
      installationId,
    });
  });

  it("fails closed when the native cryptographic UUID source is invalid", async () => {
    mockRandomUUID.mockReturnValue("not-a-secure-uuid");

    await expect(NotificationPushAPI.getInstallationId()).rejects.toThrow(
      "Secure push installation identity generation failed.",
    );
    expect(mockWriteSecureJson).not.toHaveBeenCalled();
  });

  it("serializes generation reservations monotonically", async () => {
    secureValues.set("app:push-installation:v1", {
      generation: 0,
      installationId: INSTALLATION_ID,
    });

    const [first, second] = await Promise.all([
      NotificationPushAPI.reserveGeneration(CONTEXT),
      NotificationPushAPI.reserveGeneration(CONTEXT),
    ]);

    expect(first.generation).toBe(1);
    expect(second.generation).toBe(2);
    await expect(NotificationPushAPI.isGenerationCurrent(first)).resolves.toBe(false);
    await expect(NotificationPushAPI.isGenerationCurrent(second)).resolves.toBe(true);
  });

  it("tombstones and clears a stored registration only after server confirmation", async () => {
    seedRegistration();

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({ status: "cleared" });
    expect(mockPost).toHaveBeenCalledWith(
      "/push/unregister",
      {
        ...CONTEXT,
        expoPushToken: STORED_REGISTRATION.expoPushToken,
        generation: 2,
        installationId: INSTALLATION_ID,
      },
      undefined,
    );
    expect(secureValues.has("app:push-registration")).toBe(false);
  });

  it("deactivates and clears a pre-generation persisted token through the legacy endpoint", async () => {
    const legacyRegistration = {
      ...CONTEXT,
      expoPushToken: STORED_REGISTRATION.expoPushToken,
      userId: STORED_REGISTRATION.userId,
    };
    secureValues.set("app:push-registration", legacyRegistration);

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({ status: "cleared" });
    expect(mockPost).toHaveBeenCalledWith(
      "/push/unregister",
      { expoPushToken: STORED_REGISTRATION.expoPushToken },
      undefined,
    );
    expect(secureValues.has("app:push-registration")).toBe(false);
    expect(secureValues.has("app:push-installation:v1")).toBe(false);
  });

  it("retains a pre-generation token until legacy deactivation is explicitly confirmed", async () => {
    const legacyRegistration = {
      ...CONTEXT,
      expoPushToken: STORED_REGISTRATION.expoPushToken,
      userId: STORED_REGISTRATION.userId,
    };
    secureValues.set("app:push-registration", legacyRegistration);
    mockPost.mockResolvedValue({ applied: false, currentGeneration: 0, success: true });

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      reason: "unregister-unconfirmed",
      status: "retained",
    });
    expect(secureValues.get("app:push-registration")).toEqual(legacyRegistration);
  });

  it("preserves the registration when the server does not confirm tombstone", async () => {
    seedRegistration();
    mockPost.mockResolvedValue({ success: false });

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      reason: "unregister-unconfirmed",
      status: "retained",
    });
    expect(secureValues.get("app:push-registration")).toEqual(STORED_REGISTRATION);
  });

  it("preserves the registration when tombstone fields are missing", async () => {
    seedRegistration();
    mockPost.mockResolvedValue({ currentGeneration: 2, success: true });

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      reason: "unregister-unconfirmed",
      status: "retained",
    });
    expect(secureValues.get("app:push-registration")).toEqual(STORED_REGISTRATION);
  });

  it("retains the local record when an owner-mismatch tombstone is not applied", async () => {
    seedRegistration();
    mockPost.mockResolvedValue({ applied: false, currentGeneration: 3, success: true });

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      reason: "unregister-unconfirmed",
      status: "retained",
    });
    expect(secureValues.get("app:push-registration")).toEqual(STORED_REGISTRATION);
    const next = await NotificationPushAPI.reserveGeneration(CONTEXT);
    expect(next.generation).toBe(4);
  });

  it("observes a newer server generation while retaining an unapplied tombstone", async () => {
    seedRegistration();
    mockPost.mockResolvedValue({ applied: false, currentGeneration: 10, success: true });

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      reason: "unregister-unconfirmed",
      status: "retained",
    });
    expect(secureValues.get("app:push-registration")).toEqual(STORED_REGISTRATION);
    const next = await NotificationPushAPI.reserveGeneration(CONTEXT);
    expect(next.generation).toBe(11);
  });

  it("preserves the registration when tombstone delivery fails", async () => {
    seedRegistration();
    const networkError = new Error("network unavailable");
    mockPost.mockRejectedValue(networkError);

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      error: networkError,
      reason: "unregister-failed",
      status: "retained",
    });
    expect(secureValues.get("app:push-registration")).toEqual(STORED_REGISTRATION);
  });

  it("retains registration state when secure storage cannot be read", async () => {
    const storageError = new Error("secure store unavailable");
    mockReadSecureJson.mockRejectedValue(storageError);

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      error: storageError,
      reason: "storage-read-failed",
      status: "retained",
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("tombstones by installation even when the registration record is missing", async () => {
    secureValues.set("app:push-installation:v1", {
      generation: 4,
      installationId: INSTALLATION_ID,
      lastContext: CONTEXT,
    });

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({ status: "missing" });
    expect(mockPost).toHaveBeenCalledWith(
      "/push/unregister",
      { ...CONTEXT, generation: 5, installationId: INSTALLATION_ID },
      undefined,
    );
  });

  it("does not call the server for a never-registered installation without context", async () => {
    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({ status: "missing" });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("makes a deferred register stale as soon as logout reserves its tombstone", async () => {
    const deferredRegister = createDeferred<{
      applied: boolean;
      currentGeneration: number;
      success: boolean;
    }>();
    secureValues.set("app:push-installation:v1", {
      generation: 0,
      installationId: INSTALLATION_ID,
    });
    const reservationA = await NotificationPushAPI.reserveGeneration(CONTEXT);
    mockPost.mockImplementation((path: string, body: { generation: number }) =>
      path === "/push/register"
        ? deferredRegister.promise
        : Promise.resolve({ applied: true, currentGeneration: body.generation, success: true }),
    );

    const lateRegister = NotificationPushAPI.registerToken({
      ...reservationA,
      expoProjectId: CONTEXT.expoProjectId,
      expoPushToken: STORED_REGISTRATION.expoPushToken,
    });
    const logout = bestEffortUnregisterStoredPushToken();
    await flushAsyncWork();
    deferredRegister.resolve({ applied: false, currentGeneration: 2, success: true });

    await expect(logout).resolves.toEqual({ status: "missing" });
    await expect(lateRegister).resolves.toEqual({
      applied: false,
      currentGeneration: 2,
      success: true,
    });
    await expect(NotificationPushAPI.isGenerationCurrent(reservationA)).resolves.toBe(false);
  });

  it("keeps B when A's registration response completes after B", async () => {
    const deferredA = createDeferred<{
      applied: boolean;
      currentGeneration: number;
      success: boolean;
    }>();
    secureValues.set("app:push-installation:v1", {
      generation: 0,
      installationId: INSTALLATION_ID,
    });
    const reservationA = await NotificationPushAPI.reserveGeneration(CONTEXT);
    mockPost.mockImplementation((path: string, body: { generation: number }) =>
      path === "/push/register" && body.generation === reservationA.generation
        ? deferredA.promise
        : Promise.resolve({ applied: true, currentGeneration: body.generation, success: true }),
    );
    const lateA = NotificationPushAPI.registerToken({
      ...reservationA,
      expoProjectId: CONTEXT.expoProjectId,
      expoPushToken: STORED_REGISTRATION.expoPushToken,
    });

    const reservationB = await NotificationPushAPI.reserveGeneration(CONTEXT);
    const tokenB = "ExponentPushToken[push-token-b]";
    const responseB = await NotificationPushAPI.registerToken({
      ...reservationB,
      expoProjectId: CONTEXT.expoProjectId,
      expoPushToken: tokenB,
    });
    expect(responseB.applied).toBe(true);
    await expect(
      NotificationPushAPI.rememberRegistration({
        ...reservationB,
        expoPushToken: tokenB,
        userId: "user-2",
      }),
    ).resolves.toBe(true);

    deferredA.resolve({ applied: false, currentGeneration: 2, success: true });
    const responseA = await lateA;
    await NotificationPushAPI.observeServerGeneration(
      reservationA.installationId,
      responseA.currentGeneration,
    );
    await expect(
      NotificationPushAPI.rememberRegistration({
        ...reservationA,
        expoPushToken: STORED_REGISTRATION.expoPushToken,
        userId: "user-1",
      }),
    ).resolves.toBe(false);
    await expect(NotificationPushAPI.getStoredRegistration()).resolves.toEqual(
      expect.objectContaining({ expoPushToken: tokenB, generation: 2, userId: "user-2" }),
    );
  });

  it("does not let a late tombstone clear a newer registration", async () => {
    seedRegistration();
    const deferredUnregister = createDeferred<{
      applied: boolean;
      currentGeneration: number;
      success: boolean;
    }>();
    mockPost.mockReturnValue(deferredUnregister.promise);

    const lateCleanup = bestEffortUnregisterStoredPushToken();
    await flushAsyncWork();
    const next = await NotificationPushAPI.reserveGeneration(CONTEXT);
    await NotificationPushAPI.rememberRegistration({
      ...next,
      expoPushToken: "ExponentPushToken[push-token-b]",
      userId: "user-2",
    });
    deferredUnregister.resolve({ applied: true, currentGeneration: 2, success: true });

    await expect(lateCleanup).resolves.toEqual({ status: "superseded" });
    await expect(NotificationPushAPI.getStoredRegistration()).resolves.toEqual(
      expect.objectContaining({ generation: 3, userId: "user-2" }),
    );
  });

  it("preserves registration when local cleanup cannot be confirmed", async () => {
    seedRegistration();
    const storageError = new Error("secure store unavailable");
    mockRemoveSecurePersistedValue.mockRejectedValue(storageError);

    await expect(bestEffortUnregisterStoredPushToken()).resolves.toEqual({
      error: storageError,
      reason: "storage-clear-failed",
      status: "retained",
    });
  });
});

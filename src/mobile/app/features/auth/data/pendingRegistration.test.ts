import {
  finalizePendingRegistrationAfterAuth,
  finalizePendingRegistrationOrThrow,
  PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE,
} from "./pendingRegistration";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

const AsyncStorage = jest.requireMock("@react-native-async-storage/async-storage") as {
  getItem: jest.Mock;
};

const { supabase } = jest.requireMock("../../../platform/supabase") as {
  supabase: {
    auth: {
      getSession: jest.Mock;
    };
  };
};

describe("finalizePendingRegistrationOrThrow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when no pending registration draft can be finalized", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: null,
      },
    });

    await expect(finalizePendingRegistrationAfterAuth()).resolves.toBe(false);
    await expect(finalizePendingRegistrationOrThrow()).rejects.toThrow(
      PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE,
    );
  });
});

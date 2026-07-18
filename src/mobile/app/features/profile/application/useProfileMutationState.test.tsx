import { act, renderHook } from "@testing-library/react-native";
import { useProfileMutationState } from "./useProfileMutationState";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("useProfileMutationState", () => {
  it("rolls back and captures the error when a mutation fails", async () => {
    const rollback = jest.fn();
    const { result } = renderHook(() => useProfileMutationState());

    await act(async () => {
      await expect(
        result.current.runMutation({
          execute: async () => {
            throw new Error("boom");
          },
          kind: "relationship",
          rollback,
        }),
      ).rejects.toThrow("boom");
    });

    expect(rollback).toHaveBeenCalledTimes(1);
    expect(result.current.relationshipError).toBe("boom");
    expect(result.current.reportError).toBeNull();
    expect(result.current.isRelationshipPending).toBe(false);
  });

  it("tracks report pending only while the report mutation is inflight", async () => {
    const deferred = createDeferred<void>();
    const { result } = renderHook(() => useProfileMutationState());

    let reportPromise!: Promise<void>;
    act(() => {
      reportPromise = result.current.runMutation({
        execute: () => deferred.promise,
        kind: "report",
      });
    });

    expect(result.current.isReportPending).toBe(true);

    await act(async () => {
      deferred.resolve(undefined);
      await reportPromise;
    });

    expect(result.current.isReportPending).toBe(false);
  });
});

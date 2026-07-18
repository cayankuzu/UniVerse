import { startObservedTimer } from "../../platform/observability";

interface ObserveMutationParams<T> {
  meta?: Record<string, unknown>;
  name: string;
  task: () => Promise<T>;
  toSuccessMeta?: (value: T) => Record<string, unknown> | undefined;
}

function getObservedErrorMessage(error: unknown) {
  return String((error as { message?: string })?.message || error || "unknown-error");
}

export async function observeMutation<T>({
  meta,
  name,
  task,
  toSuccessMeta,
}: ObserveMutationParams<T>) {
  const stopTelemetry = startObservedTimer({
    category: "mutation",
    meta,
    name,
  });
  try {
    const result = await task();
    stopTelemetry("ok", toSuccessMeta?.(result));
    return result;
  } catch (error) {
    stopTelemetry("error", {
      message: getObservedErrorMessage(error),
    });
    throw error;
  }
}

import { startTransition, useCallback, type SetStateAction } from "react";

export function useTransitionSetter<T>(setter: (value: SetStateAction<T>) => void) {
  return useCallback(
    (value: SetStateAction<T>) => {
      startTransition(() => {
        setter(value);
      });
    },
    [setter],
  );
}

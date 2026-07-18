import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        setDebouncedValue(value);
      },
      Math.max(0, delayMs),
    );
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

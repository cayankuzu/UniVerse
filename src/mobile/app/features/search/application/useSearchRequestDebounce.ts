import { useMemo } from "react";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";

export const SEARCH_REQUEST_DEBOUNCE_MS = 180;

export interface SearchRequestDebounceInput {
  category: string;
  fee: "" | "free" | "paid";
  query: string;
  sort: string;
  university: string;
}

function normalizeScopeValue(value: string, maxLength: number) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, maxLength);
}

export function buildSearchRequestScope(input: SearchRequestDebounceInput) {
  return JSON.stringify({
    category: normalizeScopeValue(input.category, 40),
    fee: normalizeScopeValue(input.fee, 12),
    q: normalizeScopeValue(input.query, 80),
    sort: normalizeScopeValue(input.sort, 12),
    university: normalizeScopeValue(input.university, 40),
  });
}

export function useSearchRequestDebounce(
  input: SearchRequestDebounceInput,
  debounceMs = SEARCH_REQUEST_DEBOUNCE_MS,
) {
  const stableInput = useMemo(
    () => ({
      category: input.category,
      fee: input.fee,
      query: input.query,
      sort: input.sort,
      university: input.university,
    }),
    [input.category, input.fee, input.query, input.sort, input.university],
  );
  const debouncedInput = useDebouncedValue(stableInput, debounceMs);
  const debouncedScope = useMemo(() => buildSearchRequestScope(debouncedInput), [debouncedInput]);

  return {
    debouncedInput,
    debouncedScope,
  };
}

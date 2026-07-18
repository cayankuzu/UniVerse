function getErrorMessage(error: unknown): string {
  return String((error as { message?: string })?.message || error || "");
}

function isProfileNotFoundError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes("profile not found");
}

function isProfilesRlsError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("row-level security policy") && message.includes("profiles");
}

export function isUnauthorizedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("unauthorized") || message.includes("invalid jwt");
}

export function isProfileLookupError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    isProfileNotFoundError(error) ||
    message.includes("no rows") ||
    message.includes("row not found") ||
    isProfilesRlsError(error)
  );
}

export { getErrorMessage };

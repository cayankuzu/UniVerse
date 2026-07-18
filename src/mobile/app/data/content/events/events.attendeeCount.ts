export function resolveEventAttendeesCount(attendees: unknown, joined: unknown) {
  const parsedCount = Number(attendees || 0);
  const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? Math.floor(parsedCount) : 0;

  return joined ? Math.max(1, safeCount) : safeCount;
}

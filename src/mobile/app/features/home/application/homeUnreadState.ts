export function resolveHomeUnreadCount(params: {
  badgeUnreadCount?: number | null;
  cachedNotificationsUnreadCount?: number | null;
  shouldUseStartupPreview: boolean;
  startupUnreadCount?: number | null;
}): number {
  const candidates: Array<number | null | undefined> = [
    params.badgeUnreadCount,
    params.cachedNotificationsUnreadCount,
    params.shouldUseStartupPreview ? params.startupUnreadCount : null,
  ];

  let maxCount = 0;
  for (const value of candidates) {
    const nextCount = Number(value ?? 0);
    if (!Number.isFinite(nextCount)) continue;
    maxCount = Math.max(maxCount, Math.max(0, nextCount));
  }

  return maxCount;
}

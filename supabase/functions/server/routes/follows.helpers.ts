type UserTargetRecord = {
  userId?: string | null;
};

type OutgoingRequestRecord = {
  toUserId?: string | null;
};

type IncomingRequestRecord = {
  fromUserId?: string | null;
};

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function replaceByNormalizedId<T>(rows: T[], next: T, readId: (item: T) => unknown) {
  const nextId = normalizeId(readId(next));
  if (!nextId) return [...rows];
  return [...rows.filter((item) => normalizeId(readId(item)) !== nextId), next];
}

function includesNormalizedId<T>(rows: T[], targetId: string, readId: (item: T) => unknown) {
  const normalizedTargetId = normalizeId(targetId);
  if (!normalizedTargetId) return false;
  return rows.some((item) => normalizeId(readId(item)) === normalizedTargetId);
}

export function isSelfTarget(actorId: string, targetId: string) {
  const normalizedActorId = normalizeId(actorId);
  return Boolean(normalizedActorId) && normalizedActorId === normalizeId(targetId);
}

export function hasFollowRecordForUserId<T extends UserTargetRecord>(rows: T[], userId: string) {
  return includesNormalizedId(rows, userId, (item) => item.userId);
}

export function upsertFollowRecordByUserId<T extends UserTargetRecord>(rows: T[], next: T) {
  return replaceByNormalizedId(rows, next, (item) => item.userId);
}

export function hasOutgoingFollowRequestForUserId<T extends OutgoingRequestRecord>(
  rows: T[],
  userId: string,
) {
  return includesNormalizedId(rows, userId, (item) => item.toUserId);
}

export function upsertOutgoingFollowRequestByUserId<T extends OutgoingRequestRecord>(
  rows: T[],
  next: T,
) {
  return replaceByNormalizedId(rows, next, (item) => item.toUserId);
}

export function hasIncomingFollowRequestForUserId<T extends IncomingRequestRecord>(
  rows: T[],
  userId: string,
) {
  return includesNormalizedId(rows, userId, (item) => item.fromUserId);
}

export function upsertIncomingFollowRequestByUserId<T extends IncomingRequestRecord>(
  rows: T[],
  next: T,
) {
  return replaceByNormalizedId(rows, next, (item) => item.fromUserId);
}

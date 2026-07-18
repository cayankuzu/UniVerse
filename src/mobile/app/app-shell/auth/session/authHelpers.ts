import type { UIFollowRequest } from "../../../data/notifications";

export function normalizeUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

export function sameFollowRequests(a: UIFollowRequest[], b: UIFollowRequest[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.username !== right.username ||
      left.name !== right.name ||
      left.image !== right.image ||
      left.university !== right.university ||
      left.time !== right.time ||
      left.accountType !== right.accountType
    ) {
      return false;
    }
  }
  return true;
}

import type { AccountType } from "../contracts/api";

export function resolveProfilePrivacy(
  accountType: AccountType | string | null | undefined,
  isPrivate: unknown,
) {
  return accountType === "club" ? false : Boolean(isPrivate);
}

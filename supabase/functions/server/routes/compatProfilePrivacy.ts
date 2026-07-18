export function resolveCompatProfilePrivacy(
  accountType: string | null | undefined,
  isPrivate: unknown,
) {
  return accountType === "club" ? false : Boolean(isPrivate);
}

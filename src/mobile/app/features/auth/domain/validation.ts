export const USERNAME_REGEX = /^[a-z0-9_]+$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  const raw = username.trim();
  return raw.length >= 3 && USERNAME_REGEX.test(raw);
}

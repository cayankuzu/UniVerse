export const PASSWORD_POLICY = {
  maxLength: 72,
  minLength: 10,
} as const;

export const PASSWORD_POLICY_PATTERNS = {
  digit: /\d/,
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
} as const;

export type PasswordPolicyIssue = "digit" | "lowercase" | "maxLength" | "minLength" | "uppercase";

export function getPasswordPolicyIssues(password: string): PasswordPolicyIssue[] {
  const normalized = String(password || "");
  const issues: PasswordPolicyIssue[] = [];

  if (normalized.length < PASSWORD_POLICY.minLength) {
    issues.push("minLength");
  }
  if (normalized.length > PASSWORD_POLICY.maxLength) {
    issues.push("maxLength");
  }
  if (!PASSWORD_POLICY_PATTERNS.lowercase.test(normalized)) {
    issues.push("lowercase");
  }
  if (!PASSWORD_POLICY_PATTERNS.uppercase.test(normalized)) {
    issues.push("uppercase");
  }
  if (!PASSWORD_POLICY_PATTERNS.digit.test(normalized)) {
    issues.push("digit");
  }

  return issues;
}

export function isPasswordPolicySatisfied(password: string) {
  return getPasswordPolicyIssues(password).length === 0;
}

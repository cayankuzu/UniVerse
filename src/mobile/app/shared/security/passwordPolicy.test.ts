import {
  getPasswordPolicyIssues,
  isPasswordPolicySatisfied,
  PASSWORD_POLICY,
} from "./passwordPolicy";

describe("password policy", () => {
  it("accepts passwords that satisfy the shared policy", () => {
    expect(isPasswordPolicySatisfied("StrongPass123")).toBe(true);
  });

  it("reports each missing requirement", () => {
    expect(getPasswordPolicyIssues("weak")).toEqual(["minLength", "uppercase", "digit"]);
    expect(getPasswordPolicyIssues("A".repeat(PASSWORD_POLICY.maxLength + 1))).toContain(
      "maxLength",
    );
  });
});

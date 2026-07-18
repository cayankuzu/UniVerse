import { buildResetStateForRoute } from "./navigationTargets";
import { rootNavigationLinking } from "./rootNavigation.linking";

describe("root navigation deep links", () => {
  it("maps auth callback and reset password at the root level", () => {
    expect(rootNavigationLinking.config?.screens).toMatchObject({
      AuthCallback: "auth/callback",
      ResetPassword: "reset-password",
    });
  });

  it("builds direct root reset states for auth callback routes", () => {
    expect(buildResetStateForRoute("AuthCallback")).toEqual({
      index: 0,
      routes: [{ name: "AuthCallback" }],
    });

    expect(buildResetStateForRoute("ResetPassword")).toEqual({
      index: 0,
      routes: [{ name: "ResetPassword" }],
    });
  });
});

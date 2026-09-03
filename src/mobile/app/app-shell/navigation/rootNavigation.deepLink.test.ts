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

  it("resolves linked routes without handing deep-link query or fragment data to the parser", () => {
    const getState = rootNavigationLinking.getStateFromPath;
    expect(getState).toBeDefined();

    const options = rootNavigationLinking.config;
    const hostileQuery = `?next=${"%".repeat(2048)}`;

    expect(getState?.("auth/callback", options)).toMatchObject({
      routes: [{ name: "AuthCallback" }],
    });
    expect(getState?.(`auth/callback${hostileQuery}`, options)).toEqual(
      getState?.("auth/callback", options),
    );
    expect(getState?.(`reset-password${hostileQuery}#access_token=secret`, options)).toEqual(
      getState?.("reset-password", options),
    );
  });

  it("never exposes deep-link params to the linked screens", () => {
    const options = rootNavigationLinking.config;
    const state = rootNavigationLinking.getStateFromPath?.(
      "reset-password?token=abc&code=def",
      options,
    );

    expect(state?.routes.at(-1)?.params).toBeUndefined();
  });
});

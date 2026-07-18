import {
  buildNavigateTarget,
  buildResetStateForRoute,
  navigateToRoute,
  resolveActiveRouteName,
} from "./navigationTargets";

describe("navigationTargets", () => {
  it("builds auth, tab, and direct root navigate targets", () => {
    expect(buildNavigateTarget("Login")).toEqual({
      name: "AuthNavigator",
      params: { screen: "Login" },
    });
    expect(buildNavigateTarget("VerifyEmail", { email: "test@example.com" })).toEqual({
      name: "AuthNavigator",
      params: {
        params: { email: "test@example.com" },
        screen: "VerifyEmail",
      },
    });
    expect(buildNavigateTarget("Search")).toEqual({
      name: "MainTabsNavigator",
      params: {
        params: { screen: "Search" },
        screen: "SearchTab",
      },
    });
    expect(buildNavigateTarget("EventDetail", { eventId: "event-1" })).toEqual({
      name: "EventDetail",
      params: { eventId: "event-1" },
    });
  });

  it("builds reset state for auth, tab, and direct routes", () => {
    expect(buildResetStateForRoute("ForgotPassword")).toEqual({
      index: 0,
      routes: [
        {
          name: "AuthNavigator",
          state: {
            index: 0,
            routes: [{ name: "ForgotPassword" }],
          },
        },
      ],
    });
    expect(buildResetStateForRoute("Home")).toEqual({
      index: 0,
      routes: [
        {
          name: "MainTabsNavigator",
          state: {
            index: 0,
            routes: [
              {
                name: "HomeTab",
                state: {
                  index: 0,
                  routes: [{ name: "Home" }],
                },
              },
            ],
          },
        },
      ],
    });
    expect(buildResetStateForRoute("UserList", { type: "followers", username: "ada" })).toEqual({
      index: 0,
      routes: [{ name: "UserList", params: { type: "followers", username: "ada" } }],
    });
  });

  it("navigates only when the navigation object has a callable navigate method", () => {
    const navigate = jest.fn();

    navigateToRoute({ navigate }, "ViewProfile", { username: "ada" });
    navigateToRoute({ navigate: null }, "ViewProfile", { username: "ignored" });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("ViewProfile", { username: "ada" });
  });

  it("resolves the deepest active route name", () => {
    expect(resolveActiveRouteName()).toBe("");
    expect(
      resolveActiveRouteName({
        index: 0,
        routes: [
          {
            name: "MainTabsNavigator",
            state: {
              index: 0,
              routes: [{ name: "ProfileTab", state: { routes: [{ name: "Profile" }] } }],
            },
          },
        ],
      }),
    ).toBe("Profile");
  });
});

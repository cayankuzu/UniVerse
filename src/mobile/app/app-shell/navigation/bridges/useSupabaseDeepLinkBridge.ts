import { useEffect } from "react";
import { CommonActions, type NavigationContainerRefWithCurrent } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { handleSupabaseDeepLink } from "../../../platform/supabase";
import { buildResetStateForRoute } from "../navigationTargets";
import type { RootNavigatorParamList } from "../types";

function resetToScrubbedRoute(
  navigationRef: NavigationContainerRefWithCurrent<RootNavigatorParamList>,
  routeName: "AuthCallback" | "ResetPassword",
  attempt = 0,
) {
  if (!navigationRef.isReady()) {
    if (attempt >= 20) return;
    setTimeout(() => resetToScrubbedRoute(navigationRef, routeName, attempt + 1), 100);
    return;
  }

  navigationRef.dispatch(CommonActions.reset(buildResetStateForRoute(routeName)));
}

export function useSupabaseDeepLinkBridge(
  navigationRef: NavigationContainerRefWithCurrent<RootNavigatorParamList>,
) {
  useEffect(() => {
    const apply = async (url: string | null) => {
      if (!url) return;
      try {
        const handled = await handleSupabaseDeepLink(url);
        if (handled.hadAuthPayload && handled.target) {
          resetToScrubbedRoute(navigationRef, handled.target);
        }
      } catch {
        // ignore malformed urls
      }
    };

    void Linking.getInitialURL().then(apply);
    const sub = Linking.addEventListener("url", ({ url }) => {
      void apply(url);
    });

    return () => sub.remove();
  }, [navigationRef]);
}

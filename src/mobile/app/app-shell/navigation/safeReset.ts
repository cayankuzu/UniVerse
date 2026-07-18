import { CommonActions, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { RootStackParamList } from "./types";
import { buildResetStateForRoute } from "./navigationTargets";

export function safeResetToRoute(
  navigation: Pick<NavigationProp<ParamListBase>, "dispatch" | "getState">,
  routeName: keyof RootStackParamList,
): boolean {
  navigation.dispatch(CommonActions.reset(buildResetStateForRoute(routeName)));
  return true;
}

export async function resetToRouteWhenReady(
  navigation: Pick<NavigationProp<ParamListBase>, "dispatch" | "getState">,
  routeName: keyof RootStackParamList,
  options?: { attempts?: number; delayMs?: number },
): Promise<boolean> {
  const attempts = Math.max(1, options?.attempts ?? 10);
  const delayMs = Math.max(0, options?.delayMs ?? 80);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (safeResetToRoute(navigation, routeName)) {
      return true;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

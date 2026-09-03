import { getStateFromPath, type LinkingOptions } from "@react-navigation/native";
import { APP_SCHEME } from "../../platform/config/runtime";
import { buildAppUrl } from "../../platform/linking/appUrl";
import type { RootNavigatorParamList } from "./types";

/**
 * Both linked routes declare `undefined` params, so navigation never consumes deep-link query
 * or fragment data; the Supabase bridge parses auth payloads itself and resets to a scrubbed
 * route. Dropping the query/fragment keeps routing identical while stopping attacker-controlled
 * percent-encoded input from reaching React Navigation's query parser, whose decoder degrades
 * exponentially on malformed input (GHSA-vcc3-ghjq-m6fr).
 */
const getStateFromLinkedPath: NonNullable<
  LinkingOptions<RootNavigatorParamList>["getStateFromPath"]
> = (path, options) => getStateFromPath(path.replace(/[?#][\s\S]*$/, ""), options);

export const rootNavigationLinking: LinkingOptions<RootNavigatorParamList> = {
  prefixes: [buildAppUrl("/"), `${APP_SCHEME}://`],
  config: {
    screens: {
      AuthCallback: "auth/callback",
      ResetPassword: "reset-password",
    },
  },
  getStateFromPath: getStateFromLinkedPath,
};

import type { LinkingOptions } from "@react-navigation/native";
import { APP_SCHEME } from "../../platform/config/runtime";
import { buildAppUrl } from "../../platform/linking/appUrl";
import type { RootNavigatorParamList } from "./types";

export const rootNavigationLinking: LinkingOptions<RootNavigatorParamList> = {
  prefixes: [buildAppUrl("/"), `${APP_SCHEME}://`],
  config: {
    screens: {
      AuthCallback: "auth/callback",
      ResetPassword: "reset-password",
    },
  },
};

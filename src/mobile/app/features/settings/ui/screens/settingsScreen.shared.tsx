import { Lock, LogOut, Shield, Trash2, User, UserX, type LucideIcon } from "lucide-react-native";

import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";

export type SettingsRoute =
  "BlockedUsers" | "ChangePassword" | "EditProfile" | "Permissions" | "PrivacySettings";

export type SettingsActionKey = "delete-account" | "logout" | "navigate";

type SettingsAccountKey = "blocked-users" | "change-password" | "edit-profile" | "privacy";

type SettingsAccountItem = {
  key: SettingsAccountKey;
  route: Exclude<SettingsRoute, "Permissions">;
};

export interface SettingsActionCardData {
  action: SettingsActionKey;
  chevronColor?: string;
  disabled?: boolean;
  iconBackgroundColor: string;
  iconColor: string;
  Icon: LucideIcon;
  key: string;
  route?: SettingsRoute;
  subtitle: string;
  subtitleColor?: string;
  title: string;
  titleColor?: string;
  borderColor?: string;
}

export interface SettingsSectionData {
  items: SettingsActionCardData[];
  key: "account" | "other" | "permissions";
  label: string;
}

function buildSettingsAccountItems(accountType: "club" | "student" | null | undefined) {
  const items: SettingsAccountItem[] = [{ key: "edit-profile", route: "EditProfile" }];

  if (accountType !== "club") {
    items.push({ key: "privacy", route: "PrivacySettings" });
  }

  items.push(
    { key: "change-password", route: "ChangePassword" },
    { key: "blocked-users", route: "BlockedUsers" },
  );

  return items;
}

function buildSettingsAccountCards(
  items: SettingsAccountItem[],
  blockedUsersCount: number,
): SettingsActionCardData[] {
  return items.map((item) => {
    if (item.key === "edit-profile") {
      return {
        action: "navigate",
        iconBackgroundColor: tokens.colors.primarySofter,
        iconColor: tokens.colors.primary,
        Icon: User,
        key: item.key,
        route: item.route,
        subtitle: t("settings.editProfile.subtitle"),
        title: t("settings.editProfile.title"),
      };
    }

    if (item.key === "privacy") {
      return {
        action: "navigate",
        iconBackgroundColor: tokens.colors.successSoft,
        iconColor: tokens.colors.successIcon,
        Icon: Shield,
        key: item.key,
        route: item.route,
        subtitle: t("settings.privacy.subtitle"),
        title: t("settings.privacy.label"),
      };
    }

    if (item.key === "change-password") {
      return {
        action: "navigate",
        iconBackgroundColor: tokens.colors.violetSoft,
        iconColor: tokens.colors.violet,
        Icon: Lock,
        key: item.key,
        route: item.route,
        subtitle: t("settings.changePassword.subtitle"),
        title: t("settings.changePassword.title"),
      };
    }

    return {
      action: "navigate",
      iconBackgroundColor: tokens.colors.dangerSoft,
      iconColor: tokens.colors.danger,
      Icon: UserX,
      key: item.key,
      route: item.route,
      subtitle: `${t("settings.blockedUsers.subtitle")}${blockedUsersCount > 0 ? ` (${blockedUsersCount})` : ""}`,
      title: t("settings.blockedUsers.title"),
    };
  });
}

export function buildSettingsSections(params: {
  accountType: "club" | "student" | null | undefined;
  blockedUsersCount: number;
  deletingAccount?: boolean;
  loggingOut?: boolean;
}): SettingsSectionData[] {
  return [
    {
      items: buildSettingsAccountCards(
        buildSettingsAccountItems(params.accountType),
        params.blockedUsersCount,
      ),
      key: "account",
      label: t("settings.sections.account"),
    },
    {
      items: [
        {
          action: "navigate",
          iconBackgroundColor: tokens.colors.primarySofter,
          iconColor: tokens.colors.primary,
          Icon: Shield,
          key: "permissions",
          route: "Permissions",
          subtitle: t("settings.permissions.subtitle"),
          title: t("settings.permissions.title"),
        },
      ],
      key: "permissions",
      label: t("settings.sections.permissions"),
    },
    {
      items: [
        {
          action: "logout",
          chevronColor: tokens.colors.border,
          disabled: Boolean(params.loggingOut),
          iconBackgroundColor: tokens.colors.warningSoft,
          iconColor: tokens.colors.warningIcon,
          Icon: LogOut,
          key: "logout",
          subtitle: params.loggingOut
            ? t("settings.logout.pending")
            : t("settings.logout.subtitle"),
          title: t("settings.logout.title"),
        },
        {
          action: "delete-account",
          borderColor: tokens.colors.dangerSurface,
          chevronColor: tokens.colors.border,
          disabled: Boolean(params.deletingAccount),
          iconBackgroundColor: tokens.colors.dangerSurface,
          iconColor: tokens.colors.danger,
          Icon: Trash2,
          key: "delete-account",
          subtitle: params.deletingAccount
            ? t("common.deleting")
            : t("settings.deleteAccount.subtitle"),
          title: t("settings.deleteAccount.title"),
          titleColor: tokens.colors.danger,
        },
      ],
      key: "other",
      label: t("settings.sections.other"),
    },
  ];
}

import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Image as ImageIcon,
  Mail,
  MapPin,
  Users,
} from "lucide-react-native";
import { AppImage } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

type Props = {
  accountType: "student" | "club";
  username: string;
  displayName: string;
  email: string;
  university: string;
  department: string;
  gradeYear: string;
  about: string;
  profileImageUri: string;
  coverImageUri: string;
  selectedCategories: string[];
  followers: number;
  following: number;
  hideEmail: boolean;
};

export function EditProfilePreviewCard({
  accountType,
  username,
  displayName,
  email,
  university,
  department,
  gradeYear,
  about,
  profileImageUri,
  coverImageUri,
  selectedCategories,
  followers,
  following,
  hideEmail,
}: Props) {
  const isClub = accountType === "club";

  return (
    <View
      style={{
        borderRadius: tokens.radius.card,
        borderWidth: 1,
        borderColor: withAlpha(tokens.colors.foreground, 0.08),
        overflow: "hidden",
        backgroundColor: tokens.colors.background,
      }}
    >
      <View
        style={{
          minHeight: tokens.minHeight.header,
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: tokens.spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border,
          backgroundColor: withAlpha(tokens.colors.onMedia, 0.9),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.body,
            fontWeight: tokens.fontWeight.bold,
          }}
          numberOfLines={1}
        >
          @{username || t("profile.preview.defaultUsername")}
        </Text>
        <View
          style={{
            borderRadius: tokens.radius.sm,
            backgroundColor: tokens.colors.primarySofter,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.microPlus,
          }}
        >
          <Text
            style={{
              color: tokens.colors.primary,
              fontSize: tokens.typography.micro,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            {t("common.preview")}
          </Text>
        </View>
      </View>

      <View style={{ height: 112, backgroundColor: tokens.colors.border }}>
        {coverImageUri ? (
          <AppImage
            uri={coverImageUri}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: tokens.colors.primaryBorder }} />
        )}
      </View>

      <View
        style={{
          backgroundColor: tokens.colors.surface,
          paddingHorizontal: tokens.spacing.sm,
          paddingBottom: tokens.spacing.sm,
        }}
      >
        <View style={{ marginTop: -22, marginBottom: tokens.spacing.xs }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: tokens.radius.lg,
              borderWidth: 3,
              borderColor: tokens.colors.surface,
              overflow: "hidden",
              backgroundColor: tokens.colors.border,
            }}
          >
            {profileImageUri ? (
              <AppImage
                uri={profileImageUri}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Users
                  size={tokens.iconSize["2xl"]}
                  color={tokens.colors.mutedFg}
                  strokeWidth={1.7}
                />
              </View>
            )}
          </View>
        </View>

        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.cardTitle,
            fontWeight: tokens.fontWeight.bold,
          }}
          numberOfLines={1}
        >
          {displayName ||
            (isClub
              ? t("profile.preview.defaultName.club")
              : t("profile.preview.defaultName.student"))}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.hairline,
            color: tokens.colors.mutedFg,
            fontSize: tokens.typography.caption,
          }}
          numberOfLines={1}
        >
          @{username || t("profile.preview.defaultUsername")}
        </Text>

        {!hideEmail && email ? (
          <View
            style={{
              marginTop: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <Mail size={tokens.iconSize.xs} color={tokens.colors.mutedFg} strokeWidth={2.1} />
            <Text
              style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny }}
              numberOfLines={1}
            >
              {email}
            </Text>
          </View>
        ) : null}

        {about ? (
          <Text
            style={{
              marginTop: tokens.spacing.xs,
              color: tokens.colors.dark600,
              fontSize: tokens.typography.caption,
              lineHeight: tokens.lineHeight.label,
            }}
            numberOfLines={3}
          >
            {about}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: tokens.spacing.xs,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: tokens.spacing.xs + 2,
          }}
        >
          {accountType === "student" && department ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xxs }}>
              <BookOpen size={tokens.iconSize.xs} color={tokens.colors.mutedFg} strokeWidth={2} />
              <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny }}>
                {department}
                {gradeYear ? ` - ${gradeYear}` : ""}
              </Text>
            </View>
          ) : null}
          {university ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xxs }}>
              <MapPin size={tokens.iconSize.xs} color={tokens.colors.mutedFg} strokeWidth={2} />
              <Text
                style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny }}
                numberOfLines={1}
              >
                {university}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{ marginTop: tokens.spacing.xs + 2, flexDirection: "row", gap: tokens.spacing.xs }}
        >
          <View
            style={{
              minWidth: 62,
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              paddingVertical: tokens.spacing.xs,
            }}
          >
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.subtitle,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {followers}
            </Text>
            <Text
              style={{
                color: tokens.colors.mutedFg,
                fontSize: tokens.typography.micro,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {t("profile.stats.followers")}
            </Text>
          </View>

          <View
            style={{
              minWidth: 62,
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              paddingVertical: tokens.spacing.xs,
            }}
          >
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.subtitle,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {following}
            </Text>
            <Text
              style={{
                color: tokens.colors.mutedFg,
                fontSize: tokens.typography.micro,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {t("profile.stats.following")}
            </Text>
          </View>
        </View>

        {selectedCategories.length > 0 ? (
          <View
            style={{
              marginTop: tokens.spacing.xs + 2,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: tokens.spacing.xsMinus,
            }}
          >
            {selectedCategories.slice(0, 14).map((category) => (
              <View
                key={category}
                style={{
                  borderRadius: tokens.radius.sm,
                  backgroundColor: tokens.colors.primarySofter,
                  paddingHorizontal: tokens.spacing.xs,
                  paddingVertical: tokens.spacing.xxs,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.primary,
                    fontSize: tokens.typography.micro,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {category}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={{
            marginTop: tokens.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: tokens.colors.surfaceVariant,
            paddingTop: tokens.spacing.xs + 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[t("profile.preview.tabs.albums"), t("profile.preview.tabs.events")].map(
              (tab, idx) => (
                <View
                  key={tab}
                  style={{ flex: 1, alignItems: "center", gap: tokens.spacing.micro }}
                >
                  {idx === 0 ? (
                    <ImageIcon
                      size={tokens.iconSize.sm}
                      color={tokens.colors.primary}
                      strokeWidth={2}
                    />
                  ) : idx === 1 ? (
                    <Calendar
                      size={tokens.iconSize.sm}
                      color={tokens.colors.mutedFg}
                      strokeWidth={2}
                    />
                  ) : (
                    <Users
                      size={tokens.iconSize.sm}
                      color={tokens.colors.mutedFg}
                      strokeWidth={2}
                    />
                  )}
                  <Text
                    style={{
                      color: idx === 0 ? tokens.colors.primary : tokens.colors.mutedFg,
                      fontSize: tokens.typography.micro,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {tab}
                  </Text>
                </View>
              ),
            )}
          </View>

          <View style={{ marginTop: tokens.spacing.xs + 2, alignItems: "center" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: tokens.radius.md,
                backgroundColor: tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageIcon size={22} color={tokens.colors.mutedFg} strokeWidth={1.8} />
            </View>
            <View
              style={{
                marginTop: tokens.spacing.xs,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xxs,
              }}
            >
              <Text style={{ color: tokens.colors.mutedFg, fontSize: tokens.typography.tiny }}>
                {t("profile.preview.contentPlaceholder")}
              </Text>
              <ChevronRight size={tokens.typography.tiny} color={tokens.colors.mutedFg} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

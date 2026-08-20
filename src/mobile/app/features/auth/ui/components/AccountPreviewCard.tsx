import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Image, View } from "react-native";
import { BookOpen, ImageIcon, Mail, MapPin, User, UserCircle } from "lucide-react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

interface AccountPreviewCardProps {
  accountLabel: string;
  name: string;
  username: string;
  email: string;
  university: string;
  department?: string;
  gradeYear?: string;
  about?: string;
  categories: string[];
  profileImageUri?: string;
  coverImageUri?: string;
  accent: string;
}

export function AccountPreviewCard({
  accountLabel,
  name,
  username,
  email,
  university,
  department,
  gradeYear,
  about,
  categories,
  profileImageUri,
  coverImageUri,
  accent,
}: AccountPreviewCardProps) {
  const labelValue = accountLabel || t("auth.preview.account");
  const departmentLine = [department?.trim(), gradeYear?.trim()].filter(Boolean).join(" | ");

  return (
    <View
      style={{
        borderRadius: tokens.radius.card,
        borderWidth: 1,
        borderColor: withAlpha(tokens.colors.foreground, 0.08),
        overflow: "hidden",
        backgroundColor: tokens.colors.surface,
      }}
    >
      <View
        style={{
          minHeight: 46,
          paddingHorizontal: tokens.spacing.smPlus,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border,
        }}
      >
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.body,
            fontWeight: "700",
          }}
        >
          @{username || "-"}
        </Text>
        <View
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.primarySofter,
            paddingHorizontal: tokens.spacing.compact,
            paddingVertical: tokens.spacing.xsMinus,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs,
          }}
        >
          <UserCircle size={12} color={accent} />
          <Text style={{ fontSize: tokens.typography.tiny, fontWeight: "700", color: accent }}>
            {labelValue}
          </Text>
        </View>
      </View>

      <View style={{ height: 108, backgroundColor: tokens.colors.border }}>
        {coverImageUri ? (
          <Image source={{ uri: coverImageUri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ImageIcon size={tokens.iconSize["2xl"]} color={tokens.colors.mutedFg} />
          </View>
        )}
      </View>

      <View
        style={{
          marginTop: -36,
          marginLeft: tokens.spacing.smPlus,
          width: 64,
          height: 64,
          borderRadius: tokens.radius.xl,
          overflow: "hidden",
          borderWidth: 3,
          borderColor: tokens.colors.surface,
          backgroundColor: tokens.colors.border,
        }}
      >
        {profileImageUri ? (
          <Image source={{ uri: profileImageUri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <User size={tokens.iconSize["2xl"]} color={tokens.colors.muted} />
          </View>
        )}
      </View>

      <View
        style={{
          paddingHorizontal: tokens.spacing.smPlus,
          paddingTop: tokens.spacing.xs,
          paddingBottom: tokens.spacing.smPlus,
        }}
      >
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.title,
            fontWeight: "700",
          }}
        >
          {name || "-"}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.micro,
            color: tokens.colors.muted,
            fontSize: tokens.typography.label,
          }}
        >
          @{username || "-"}
        </Text>

        <View
          style={{
            marginTop: tokens.spacing.xs,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xsMinus,
          }}
        >
          <Mail size={13} color={tokens.colors.mutedFg} />
          <Text
            style={{
              flex: 1,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              lineHeight: tokens.lineHeight.caption,
            }}
          >
            {email || "-"}
          </Text>
        </View>

        {about ? (
          <Text
            style={{
              marginTop: tokens.spacing.compact,
              color: tokens.colors.dark700,
              fontSize: tokens.typography.label,
              lineHeight: tokens.lineHeight.body,
            }}
          >
            {about}
          </Text>
        ) : null}

        {departmentLine ? (
          <View
            style={{
              marginTop: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <BookOpen size={13} color={tokens.colors.mutedFg} />
            <Text
              style={{
                flex: 1,
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.caption,
              }}
            >
              {departmentLine}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            marginTop: tokens.spacing.xs,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xsMinus,
          }}
        >
          <MapPin size={13} color={tokens.colors.mutedFg} />
          <Text
            style={{
              flex: 1,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              lineHeight: tokens.lineHeight.caption,
            }}
          >
            {university || "-"}
          </Text>
        </View>

        <View
          style={{ marginTop: tokens.spacing.sm, flexDirection: "row", gap: tokens.spacing.xs }}
        >
          <View
            style={{
              width: 68,
              minHeight: 50,
              borderRadius: tokens.radius.control,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.cardTitle,
                fontWeight: "800",
              }}
            >
              0
            </Text>
            <Text
              style={{
                color: tokens.colors.mutedFg,
                fontSize: tokens.typography.tiny,
                fontWeight: "700",
              }}
            >
              {t("auth.preview.followers")}
            </Text>
          </View>
          <View
            style={{
              width: 68,
              minHeight: 50,
              borderRadius: tokens.radius.control,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.cardTitle,
                fontWeight: "800",
              }}
            >
              0
            </Text>
            <Text
              style={{
                color: tokens.colors.mutedFg,
                fontSize: tokens.typography.tiny,
                fontWeight: "700",
              }}
            >
              {t("auth.preview.following")}
            </Text>
          </View>
        </View>

        {categories.length > 0 ? (
          <View
            style={{
              marginTop: tokens.spacing.sm,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: tokens.spacing.xsMinus,
            }}
          >
            {categories.slice(0, 8).map((category) => (
              <View
                key={category}
                style={{
                  borderRadius: tokens.radius.pill,
                  paddingHorizontal: tokens.spacing.xsPlus,
                  paddingVertical: tokens.spacing.xsMinus,
                  backgroundColor: `${accent}14`,
                }}
              >
                <Text
                  style={{ fontSize: tokens.typography.tiny, fontWeight: "700", color: accent }}
                >
                  {category}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

import React from "react";
import { Image, Text, View } from "react-native";
import { BookOpen, ImageIcon, Mail, MapPin, User, UserCircle } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
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
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.08)",
        overflow: "hidden",
        backgroundColor: tokens.colors.surface,
      }}
    >
      <View
        style={{
          minHeight: 46,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border,
        }}
      >
        <Text style={{ color: tokens.colors.foreground, fontSize: 14, fontWeight: "700" }}>
          @{username || "-"}
        </Text>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: tokens.colors.primarySofter,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <UserCircle size={12} color={accent} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: accent }}>{labelValue}</Text>
        </View>
      </View>

      <View style={{ height: 130, backgroundColor: tokens.colors.border }}>
        {coverImageUri ? (
          <Image source={{ uri: coverImageUri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ImageIcon size={24} color={tokens.colors.mutedFg} />
          </View>
        )}
      </View>

      <View
        style={{
          marginTop: -36,
          marginLeft: 14,
          width: 78,
          height: 78,
          borderRadius: 20,
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
            <User size={24} color={tokens.colors.muted} />
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14 }}>
        <Text style={{ color: tokens.colors.foreground, fontSize: 22, fontWeight: "700" }}>
          {name || "-"}
        </Text>
        <Text style={{ marginTop: 2, color: tokens.colors.muted, fontSize: 13 }}>
          @{username || "-"}
        </Text>

        <View style={{ marginTop: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Mail size={13} color={tokens.colors.mutedFg} />
          <Text style={{ flex: 1, color: tokens.colors.muted, fontSize: 12, lineHeight: 17 }}>
            {email || "-"}
          </Text>
        </View>

        {about ? (
          <Text
            style={{ marginTop: 10, color: tokens.colors.dark700, fontSize: 13, lineHeight: 20 }}
          >
            {about}
          </Text>
        ) : null}

        {departmentLine ? (
          <View style={{ marginTop: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <BookOpen size={13} color={tokens.colors.mutedFg} />
            <Text style={{ flex: 1, color: tokens.colors.muted, fontSize: 12, lineHeight: 17 }}>
              {departmentLine}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MapPin size={13} color={tokens.colors.mutedFg} />
          <Text style={{ flex: 1, color: tokens.colors.muted, fontSize: 12, lineHeight: 17 }}>
            {university || "-"}
          </Text>
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <View
            style={{
              width: 82,
              minHeight: 62,
              borderRadius: 14,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: tokens.colors.foreground, fontSize: 18, fontWeight: "800" }}>
              0
            </Text>
            <Text style={{ color: tokens.colors.mutedFg, fontSize: 11, fontWeight: "700" }}>
              {t("auth.preview.followers")}
            </Text>
          </View>
          <View
            style={{
              width: 82,
              minHeight: 62,
              borderRadius: 14,
              backgroundColor: tokens.colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: tokens.colors.foreground, fontSize: 18, fontWeight: "800" }}>
              0
            </Text>
            <Text style={{ color: tokens.colors.mutedFg, fontSize: 11, fontWeight: "700" }}>
              {t("auth.preview.following")}
            </Text>
          </View>
        </View>

        {categories.length > 0 ? (
          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {categories.slice(0, 8).map((category) => (
              <View
                key={category}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  backgroundColor: `${accent}14`,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: accent }}>{category}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

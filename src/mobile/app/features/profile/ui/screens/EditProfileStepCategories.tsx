import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check, Eye, Search, Sparkles } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
import { EditProfilePreviewCard } from "./EditProfilePreviewCard";

type Props = {
  accountType: "student" | "club";
  allowPreviewToggle?: boolean;
  showPreview: boolean;
  categorySearch: string;
  filteredCategories: string[];
  selectedCategories: string[];
  username: string;
  displayName: string;
  email: string;
  university: string;
  department: string;
  gradeYear: string;
  about: string;
  profileImageUri: string;
  coverImageUri: string;
  followers: number;
  following: number;
  hideEmail: boolean;
  onTogglePreview?: (next: boolean) => void;
  onCategorySearchChange: (value: string) => void;
  onToggleCategory: (category: string) => void;
};

export function EditProfileStepCategories({
  accountType,
  allowPreviewToggle = true,
  showPreview,
  categorySearch,
  filteredCategories,
  selectedCategories,
  username,
  displayName,
  email,
  university,
  department,
  gradeYear,
  about,
  profileImageUri,
  coverImageUri,
  followers,
  following,
  hideEmail,
  onTogglePreview,
  onCategorySearchChange,
  onToggleCategory,
}: Props) {
  return (
    <View style={{ gap: tokens.spacing.sm }}>
      {allowPreviewToggle ? (
        <View
          style={{
            flexDirection: "row",
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.colors.border,
            padding: 4,
          }}
        >
          <Pressable
            onPress={() => onTogglePreview?.(false)}
            style={{
              flex: 1,
              minHeight: tokens.minHeight.chipMd,
              borderRadius: 9,
              backgroundColor: !showPreview ? tokens.colors.surface : "transparent",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 5,
            }}
          >
            <Sparkles
              size={13}
              color={!showPreview ? tokens.colors.foreground : tokens.colors.muted}
              strokeWidth={2.2}
            />
            <Text
              style={{
                color: !showPreview ? tokens.colors.foreground : tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {accountType === "club" ? "Kategoriler" : "İlgi Alanları"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onTogglePreview?.(true)}
            style={{
              flex: 1,
              minHeight: tokens.minHeight.chipMd,
              borderRadius: 9,
              backgroundColor: showPreview ? tokens.colors.surface : "transparent",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 5,
            }}
          >
            <Eye
              size={13}
              color={showPreview ? tokens.colors.foreground : tokens.colors.muted}
              strokeWidth={2.2}
            />
            <Text
              style={{
                color: showPreview ? tokens.colors.foreground : tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              Profil Önizleme
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!allowPreviewToggle || !showPreview ? (
        <>
          <View
            style={{
              minHeight: tokens.minHeight.buttonLg,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              backgroundColor: tokens.colors.surface,
              paddingHorizontal: tokens.spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xs,
            }}
          >
            <Search size={tokens.iconSize.md} color={tokens.colors.mutedFg} strokeWidth={2.2} />
            <TextInput
              value={categorySearch}
              onChangeText={onCategorySearchChange}
              placeholder="Kategori ara..."
              placeholderTextColor={tokens.colors.mutedFg}
              style={{
                flex: 1,
                color: tokens.colors.foreground,
                fontSize: tokens.typography.body,
                paddingVertical: 10,
              }}
            />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs }}>
            {filteredCategories.map((category) => {
              const selected = selectedCategories.includes(category);
              return (
                <Pressable
                  key={category}
                  onPress={() => onToggleCategory(category)}
                  style={{
                    borderRadius: 10,
                    backgroundColor: selected ? tokens.colors.primary : tokens.colors.border,
                    paddingHorizontal: 10,
                    paddingVertical: tokens.spacing.xs,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {selected ? (
                    <Check
                      size={tokens.iconSize.xs}
                      color={tokens.colors.surface}
                      strokeWidth={2.4}
                    />
                  ) : null}
                  <Text
                    style={{
                      color: selected ? tokens.colors.surface : tokens.colors.dark600,
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              borderRadius: 10,
              backgroundColor: tokens.colors.primarySofter,
              paddingHorizontal: 10,
              paddingVertical: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.primary,
              }}
            />
            <Text
              style={{
                color: tokens.colors.primaryDeep,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {selectedCategories.length} kategori seçildi
            </Text>
          </View>
        </>
      ) : (
        <EditProfilePreviewCard
          accountType={accountType}
          username={username}
          displayName={displayName}
          email={email}
          university={university}
          department={department}
          gradeYear={gradeYear}
          about={about}
          profileImageUri={profileImageUri}
          coverImageUri={coverImageUri}
          selectedCategories={selectedCategories}
          followers={followers}
          following={following}
          hideEmail={hideEmail}
        />
      )}
    </View>
  );
}

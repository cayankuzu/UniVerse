import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { Camera, User, Users } from "lucide-react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
import { AppImage, TextField } from "../../../../shared/components";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";

type Props = {
  errors: {
    bio?: string;
    description?: string;
  };
  isClub: boolean;
  coverImageUri: string;
  profileImageUri: string;
  about: string;
  onPickCover: () => void;
  onPickProfile: () => void;
  onAboutChange: (value: string) => void;
};

export function EditProfileStepProfile({
  errors,
  isClub,
  coverImageUri,
  profileImageUri,
  about,
  onPickCover,
  onPickProfile,
  onAboutChange,
}: Props) {
  const aboutLimit = isClub ? TEXT_LIMITS.auth.clubDescription : TEXT_LIMITS.auth.bio;

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <View style={{ gap: tokens.spacing.xs }}>
        <Text
          style={{
            color: tokens.colors.dark700,
            fontSize: tokens.typography.label,
            fontWeight: tokens.fontWeight.semibold,
          }}
        >
          Kapak Fotoğrafı
        </Text>
        <Pressable
          onPress={onPickCover}
          style={{
            height: 108,
            borderRadius: tokens.radius.control,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.border,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {coverImageUri ? (
            <>
              <AppImage
                uri={coverImageUri}
                contentFit="cover"
                style={{ width: "100%", height: "100%", position: "absolute" }}
              />
              <View
                style={{
                  position: "absolute",
                  right: tokens.spacing.xs,
                  bottom: tokens.spacing.xs,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: withAlpha(tokens.colors.mediaBlack, 0.55),
                  paddingHorizontal: tokens.spacing.xsPlus,
                  paddingVertical: tokens.spacing.xxs,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xxs,
                }}
              >
                <Camera size={tokens.iconSize.xs} color={tokens.colors.surface} />
                <Text
                  style={{
                    color: tokens.colors.surface,
                    fontSize: tokens.typography.tiny,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  Değiştir
                </Text>
              </View>
            </>
          ) : (
            <View style={{ alignItems: "center", gap: tokens.spacing.xsMinus }}>
              <Camera size={tokens.iconSize["2xl"]} color={tokens.colors.muted} />
              <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.label }}>
                Kapak fotoğrafı ekle
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={{ gap: tokens.spacing.xs }}>
        <Text
          style={{
            color: tokens.colors.dark700,
            fontSize: tokens.typography.label,
            fontWeight: tokens.fontWeight.semibold,
          }}
        >
          Profil Fotoğrafı
        </Text>
        <Pressable
          onPress={onPickProfile}
          style={{
            width: 68,
            height: 68,
            borderRadius: tokens.radius.card,
            borderWidth: 2,
            borderColor: tokens.colors.surface,
            backgroundColor: tokens.colors.border,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {profileImageUri ? (
            <AppImage uri={profileImageUri} contentFit="cover" style={{ width: 68, height: 68 }} />
          ) : isClub ? (
            <Users size={tokens.iconSize["2xl"]} color={tokens.colors.muted} />
          ) : (
            <User size={tokens.iconSize["2xl"]} color={tokens.colors.muted} />
          )}

          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 20,
              height: 20,
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={tokens.iconSize.xs} color={tokens.colors.surface} />
          </View>
        </Pressable>
      </View>

      <TextField
        errorText={isClub ? errors.description : errors.bio}
        fieldName={isClub ? "description" : "bio"}
        label={isClub ? "Kulüp Açıklaması" : "Biyografi"}
        maxLength={aboutLimit}
        multiline
        onChangeText={onAboutChange}
        placeholder={isClub ? "Kulübünü anlat..." : "Kendini anlat..."}
        supportingText={`${about.length}/${aboutLimit}`}
        value={about}
      />
    </View>
  );
}

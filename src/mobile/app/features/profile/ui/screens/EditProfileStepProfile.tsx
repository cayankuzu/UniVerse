import React from "react";
import { Pressable, Text, View } from "react-native";
import { Camera, User, Users } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
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
            fontSize: 13,
            fontWeight: tokens.fontWeight.semibold,
          }}
        >
          Kapak Fotoğrafı
        </Text>
        <Pressable
          onPress={onPickCover}
          style={{
            height: 132,
            borderRadius: 14,
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
                  backgroundColor: "rgba(0,0,0,0.55)",
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
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
            <View style={{ alignItems: "center", gap: 6 }}>
              <Camera size={26} color={tokens.colors.muted} />
              <Text style={{ color: tokens.colors.muted, fontSize: 13 }}>Kapak fotoğrafı ekle</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={{ gap: tokens.spacing.xs }}>
        <Text
          style={{
            color: tokens.colors.dark700,
            fontSize: 13,
            fontWeight: tokens.fontWeight.semibold,
          }}
        >
          Profil Fotoğrafı
        </Text>
        <Pressable
          onPress={onPickProfile}
          style={{
            width: 84,
            height: 84,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: tokens.colors.surface,
            backgroundColor: tokens.colors.border,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {profileImageUri ? (
            <AppImage uri={profileImageUri} contentFit="cover" style={{ width: 84, height: 84 }} />
          ) : isClub ? (
            <Users size={30} color={tokens.colors.muted} />
          ) : (
            <User size={30} color={tokens.colors.muted} />
          )}

          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 24,
              height: 24,
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

import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";

import { GradientButton, TextField } from "../../../../shared/components";
import { isPasswordPolicySatisfied } from "../../../../shared/security/passwordPolicy";
import {
  RegistrationPasswordField,
  RegistrationProfileMediaFields,
  RegistrationStepHeading,
} from "../components";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

export function StudentRegistrationProfileStep({
  coverImageUri,
  errors,
  goNext,
  pickImage,
  profileImageUri,
  setField,
  values,
}: StudentRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="Profil" subtitle="Profil bilgilerini tamamla" />
      <RegistrationProfileMediaFields
        accent={tokens.colors.primary}
        coverImageUri={coverImageUri}
        coverLabel="Kapak Fotoğrafı"
        onPick={pickImage}
        profileImageUri={profileImageUri}
        profileLabel="Profil Fotoğrafı"
      />

      <View style={{ marginTop: tokens.spacing.sm }}>
        <TextField
          error={errors.bio?.message}
          fieldName="bio"
          label="Biyografi"
          placeholder="Kendini kisaca tanit..."
          value={values.bio}
          onChangeText={(value) => setField("bio", value)}
        />
      </View>
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          textAlign: "right",
          marginTop: tokens.spacing.xxs,
        }}
      >
        {values.bio.length}/150
      </Text>

      <RegistrationPasswordField
        password={values.password}
        passwordError={errors.password?.message}
        onPasswordChange={(value) => setField("password", value)}
      />

      <View style={{ marginTop: tokens.spacing.lg }}>
        <GradientButton
          label="Devam Et"
          onPress={() => void goNext()}
          disabled={!isPasswordPolicySatisfied(values.password)}
        />
      </View>
    </>
  );
}

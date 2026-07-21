import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";

import { GradientButton, TextField } from "../../../../shared/components";
import { isPasswordPolicySatisfied } from "../../../../shared/security/passwordPolicy";
import {
  RegistrationPasswordField,
  RegistrationProfileMediaFields,
  RegistrationStepHeading,
} from "../components";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

export function ClubRegistrationProfileStep({
  coverImageUri,
  errors,
  goNext,
  pickImage,
  profileImageUri,
  setField,
  values,
}: ClubRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="Profil" subtitle="Kulüp profil bilgilerini tamamla" />
      <RegistrationProfileMediaFields
        accent={tokens.colors.violetBrand}
        coverImageUri={coverImageUri}
        coverLabel="Kapak Fotoğrafı"
        onPick={pickImage}
        profileImageUri={profileImageUri}
        profileLabel="Kulüp Logosu"
      />

      <View style={{ marginTop: tokens.spacing.sm }}>
        <TextField
          error={errors.description?.message}
          fieldName="description"
          label="Kulüp Açıklaması"
          placeholder="Kulübünüzü kısaca tanıtın..."
          value={values.description}
          onChangeText={(value) => setField("description", value)}
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
        {values.description.length}/200
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
          variant="primary"
        />
      </View>
    </>
  );
}

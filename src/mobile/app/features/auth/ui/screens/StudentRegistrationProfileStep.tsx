import { Text, View } from "react-native";

import { GradientButton, TextField } from "../../../../shared/components";
import { isPasswordPolicySatisfied } from "../../../../shared/security/passwordPolicy";
import {
  RegistrationPasswordField,
  RegistrationProfileMediaFields,
  RegistrationStepHeading,
} from "../components";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";

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
        accent="#2563eb"
        coverImageUri={coverImageUri}
        coverLabel="Kapak Fotoğrafı"
        onPick={pickImage}
        profileImageUri={profileImageUri}
        profileLabel="Profil Fotoğrafı"
      />

      <View style={{ marginTop: 12 }}>
        <TextField
          error={errors.bio?.message}
          fieldName="bio"
          label="Biyografi"
          placeholder="Kendini kisaca tanit..."
          value={values.bio}
          onChangeText={(value) => setField("bio", value)}
        />
      </View>
      <Text style={{ color: "#94a3b8", fontSize: 12, textAlign: "right", marginTop: 4 }}>
        {values.bio.length}/150
      </Text>

      <RegistrationPasswordField
        password={values.password}
        passwordError={errors.password?.message}
        onPasswordChange={(value) => setField("password", value)}
      />

      <View style={{ marginTop: 20 }}>
        <GradientButton
          label="Devam Et"
          onPress={() => void goNext()}
          disabled={!isPasswordPolicySatisfied(values.password)}
        />
      </View>
    </>
  );
}

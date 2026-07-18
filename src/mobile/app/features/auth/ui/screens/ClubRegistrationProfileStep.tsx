import { Text, View } from "react-native";

import { GradientButton, TextField } from "../../../../shared/components";
import { isPasswordPolicySatisfied } from "../../../../shared/security/passwordPolicy";
import {
  RegistrationPasswordField,
  RegistrationProfileMediaFields,
  RegistrationStepHeading,
} from "../components";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";

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
        accent="#7c3aed"
        coverImageUri={coverImageUri}
        coverLabel="Kapak Fotoğrafı"
        onPick={pickImage}
        profileImageUri={profileImageUri}
        profileLabel="Kulüp Logosu"
      />

      <View style={{ marginTop: 12 }}>
        <TextField
          error={errors.description?.message}
          fieldName="description"
          label="Kulüp Açıklaması"
          placeholder="Kulübünüzü kısaca tanıtın..."
          value={values.description}
          onChangeText={(value) => setField("description", value)}
        />
      </View>
      <Text style={{ color: "#94a3b8", fontSize: 12, textAlign: "right", marginTop: 4 }}>
        {values.description.length}/200
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
          variant="primary"
        />
      </View>
    </>
  );
}

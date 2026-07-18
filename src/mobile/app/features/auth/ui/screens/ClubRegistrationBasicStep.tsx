import { View } from "react-native";

import { GradientButton, TextField } from "../../../../shared/components";
import { RegistrationAvailabilityHint, RegistrationStepHeading } from "../components";
import { sanitizeUsernameInput } from "../../application/useRegistrationWizard";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";

export function ClubRegistrationBasicStep({
  errors,
  goNext,
  setField,
  usernameAvailabilityError,
  usernameChecking,
  values,
}: ClubRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="Temel Bilgiler" subtitle="Kulüp bilgilerini gir" />

      <TextField
        error={errors.username?.message || usernameAvailabilityError}
        fieldName="username"
        label="Kullanıcı Adı"
        placeholder="kulupadi"
        value={values.username}
        onChangeText={(value) => setField("username", sanitizeUsernameInput(value))}
      />
      <RegistrationAvailabilityHint
        active={usernameChecking}
        text="Kullanıcı adı kontrol ediliyor..."
      />

      <View style={{ marginTop: 12 }}>
        <TextField
          error={errors.clubName?.message}
          fieldName="clubName"
          label="Kulüp Adı"
          placeholder="Kulübünüzün adı"
          value={values.clubName}
          onChangeText={(value) => setField("clubName", value)}
        />
      </View>

      <View style={{ marginTop: 20 }}>
        <GradientButton
          label="Devam Et"
          onPress={() => void goNext()}
          disabled={!values.username.trim() || !values.clubName.trim() || usernameChecking}
          variant="primary"
        />
      </View>
    </>
  );
}

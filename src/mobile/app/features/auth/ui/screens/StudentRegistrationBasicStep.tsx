import { View } from "react-native";

import { GradientButton, TextField } from "../../../../shared/components";
import { RegistrationAvailabilityHint, RegistrationStepHeading } from "../components";
import { sanitizeUsernameInput } from "../../application/useRegistrationWizard";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

export function StudentRegistrationBasicStep({
  errors,
  goNext,
  setField,
  usernameAvailabilityError,
  usernameChecking,
  values,
}: StudentRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="Temel Bilgiler" subtitle="Kullanıcı bilgilerini gir" />

      <TextField
        error={errors.username?.message || usernameAvailabilityError}
        fieldName="username"
        label="Kullanıcı Adı"
        placeholder="kullaniciadi"
        value={values.username}
        onChangeText={(value) => setField("username", sanitizeUsernameInput(value))}
      />
      <RegistrationAvailabilityHint
        active={usernameChecking}
        text="Kullanıcı adı kontrol ediliyor..."
      />

      <View style={{ marginTop: tokens.spacing.sm }}>
        <TextField
          error={errors.name?.message}
          fieldName="name"
          label="Ad Soyad"
          placeholder="Adın ve soyadın"
          value={values.name}
          onChangeText={(value) => setField("name", value)}
        />
      </View>

      <View style={{ marginTop: tokens.spacing.lg }}>
        <GradientButton
          label="Devam Et"
          onPress={() => void goNext()}
          disabled={!values.username.trim() || !values.name.trim() || usernameChecking}
        />
      </View>
    </>
  );
}

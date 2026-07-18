import { View } from "react-native";

import { universities } from "../../../../shared/catalog/taxonomy";
import { GradientButton, TextField } from "../../../../shared/components";
import { RegistrationAvailabilityHint, RegistrationStepHeading, SelectField } from "../components";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";

export function ClubRegistrationUniversityStep({
  emailAvailabilityError,
  emailChecking,
  errors,
  goNext,
  setField,
  values,
}: ClubRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading
        title="Üniversite Bilgileri"
        subtitle="Kulübünüzün bağlı olduğu üniversite"
      />

      <TextField
        error={errors.email?.message || emailAvailabilityError}
        fieldName="email"
        label="Kulüp E-postası"
        maxLength={TEXT_LIMITS.auth.email}
        placeholder="kulüp@gmail.com"
        value={values.email}
        onChangeText={(value) => setField("email", value)}
      />
      <RegistrationAvailabilityHint active={emailChecking} text="E-posta kontrol ediliyor..." />

      <View style={{ marginTop: 12 }}>
        <SelectField
          errorText={errors.university?.message}
          fieldName="university"
          label="Üniversite"
          value={values.university}
          placeholder="Üniversite seç"
          options={universities}
          onSelect={(value) => setField("university", value)}
          searchPlaceholder="Üniversite ara"
        />
      </View>

      <View style={{ marginTop: 20 }}>
        <GradientButton
          label="Devam Et"
          onPress={() => void goNext()}
          disabled={!values.email.trim() || !values.university.trim() || emailChecking}
          variant="primary"
        />
      </View>
    </>
  );
}

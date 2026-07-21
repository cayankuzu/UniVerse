import { View } from "react-native";

import { departments, gradeYears, universities } from "../../../../shared/catalog/taxonomy";
import { GradientButton, TextField } from "../../../../shared/components";
import { RegistrationAvailabilityHint, RegistrationStepHeading, SelectField } from "../components";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

export function StudentRegistrationUniversityStep({
  emailAvailabilityError,
  emailChecking,
  errors,
  goNext,
  setField,
  values,
}: StudentRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="Üniversite Bilgileri" subtitle="Okul bilgilerini gir" />

      <TextField
        error={errors.email?.message || emailAvailabilityError}
        fieldName="email"
        label="E-posta"
        maxLength={TEXT_LIMITS.auth.email}
        placeholder="isim@gmail.com"
        value={values.email}
        onChangeText={(value) => setField("email", value)}
      />
      <RegistrationAvailabilityHint active={emailChecking} text="E-posta kontrol ediliyor..." />

      <View style={{ marginTop: tokens.spacing.sm }}>
        <SelectField
          errorText={errors.university?.message}
          fieldName="university"
          label="Üniversite"
          value={values.university}
          placeholder="Üniversiteni seç"
          options={universities}
          onSelect={(value) => setField("university", value)}
          searchPlaceholder="Üniversite ara"
        />
      </View>
      <View style={{ marginTop: tokens.spacing.sm }}>
        <SelectField
          errorText={errors.department?.message}
          fieldName="department"
          label="Bölüm"
          value={values.department}
          placeholder="Bölümünü seç"
          options={departments}
          onSelect={(value) => setField("department", value)}
          searchPlaceholder="Bölüm ara"
        />
      </View>
      <View style={{ marginTop: tokens.spacing.sm }}>
        <SelectField
          errorText={errors.gradeYear?.message}
          fieldName="gradeYear"
          label="Sınıf"
          value={values.gradeYear}
          placeholder="Sınıfını seç"
          options={gradeYears}
          onSelect={(value) => setField("gradeYear", value)}
          searchPlaceholder="Sınıf ara"
        />
      </View>

      <View style={{ marginTop: tokens.spacing.lg }}>
        <GradientButton
          label="Devam Et"
          onPress={() => void goNext()}
          disabled={
            !values.email.trim() ||
            !values.university.trim() ||
            !values.department.trim() ||
            !values.gradeYear.trim() ||
            emailChecking
          }
        />
      </View>
    </>
  );
}

import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { TextField } from "../../../../shared/components";
import { SelectField } from "../../../../shared/components/SelectField";
import { departments, gradeYears, universities } from "../../../../shared/catalog/taxonomy";

type Props = {
  errors: {
    department?: string;
    email?: string;
    gradeYear?: string;
    university?: string;
  };
  isClub: boolean;
  email: string;
  university: string;
  department: string;
  gradeYear: string;
  onEmailChange: (value: string) => void;
  onUniversityChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onGradeYearChange: (value: string) => void;
};

export function EditProfileStepUniversity({
  errors,
  isClub,
  email,
  university,
  department,
  gradeYear,
  onEmailChange,
  onUniversityChange,
  onDepartmentChange,
  onGradeYearChange,
}: Props) {
  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <TextField
        errorText={errors.email}
        fieldName="email"
        label="E-posta"
        placeholder="isim@gmail.com"
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={false}
      />
      <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
        E-posta adresi hesap kimliğine bağlıdır ve bu ekranda değiştirilemez.
      </Text>

      <SelectField
        errorText={errors.university}
        fieldName="university"
        label="Üniversite"
        value={university}
        placeholder="Üniversite seç"
        options={universities}
        onSelect={onUniversityChange}
      />

      {!isClub ? (
        <>
          <SelectField
            errorText={errors.department}
            fieldName="department"
            label="Bölüm"
            value={department}
            placeholder="Bölüm seç"
            options={departments}
            onSelect={onDepartmentChange}
          />

          <SelectField
            errorText={errors.gradeYear}
            fieldName="gradeYear"
            label="Sınıf"
            value={gradeYear}
            placeholder="Sınıf seç"
            options={gradeYears}
            onSelect={onGradeYearChange}
          />
        </>
      ) : null}
    </View>
  );
}

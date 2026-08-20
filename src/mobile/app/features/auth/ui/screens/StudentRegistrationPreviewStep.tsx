import { View } from "react-native";

import { GradientButton } from "../../../../shared/components";
import {
  AccountPreviewCard,
  RegistrationStepHeading,
  RegistrationSubmitError,
  RegistrationUploadProgressCard,
} from "../components";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

export function StudentRegistrationPreviewStep({
  coverImageUri,
  profileImageUri,
  selectedCategories,
  submit,
  submitError,
  submitting,
  uploadProgress,
  values,
}: StudentRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="Ön İzleme" subtitle="Kayıt öncesi bilgilerini kontrol et" />

      <AccountPreviewCard
        accountLabel="Öğrenci Hesabı"
        name={values.name.trim()}
        username={values.username.trim()}
        email={values.email.trim().toLowerCase()}
        university={values.university.trim()}
        department={values.department.trim()}
        gradeYear={values.gradeYear.trim()}
        about={values.bio.trim()}
        categories={selectedCategories}
        profileImageUri={profileImageUri || undefined}
        coverImageUri={coverImageUri || undefined}
        accent={tokens.colors.primary}
      />

      <RegistrationUploadProgressCard
        accent={tokens.colors.primary}
        backgroundColor={tokens.colors.primarySofter}
        textColor={tokens.colors.primaryDark}
        message={uploadProgress}
      />
      <RegistrationSubmitError message={submitError} />

      <View style={{ marginTop: tokens.spacing.lg }}>
        <GradientButton label="Kayıt Ol" onPress={() => void submit()} loading={submitting} />
      </View>
    </>
  );
}

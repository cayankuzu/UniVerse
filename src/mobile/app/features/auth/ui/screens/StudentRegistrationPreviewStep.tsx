import { View } from "react-native";

import { GradientButton } from "../../../../shared/components";
import {
  AccountPreviewCard,
  RegistrationStepHeading,
  RegistrationSubmitError,
  RegistrationUploadProgressCard,
} from "../components";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";

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
      <RegistrationStepHeading title="On Izleme" subtitle="Kayıt oncesi bilgilerini kontrol et" />

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
        accent="#2563eb"
      />

      <RegistrationUploadProgressCard
        accent="#2563eb"
        backgroundColor="#eff6ff"
        textColor="#1d4ed8"
        message={uploadProgress}
      />
      <RegistrationSubmitError message={submitError} />

      <View style={{ marginTop: 20 }}>
        <GradientButton label="Kayıt Ol" onPress={() => void submit()} loading={submitting} />
      </View>
    </>
  );
}

import { View } from "react-native";

import { GradientButton } from "../../../../shared/components";
import {
  AccountPreviewCard,
  RegistrationStepHeading,
  RegistrationSubmitError,
  RegistrationUploadProgressCard,
} from "../components";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";

export function ClubRegistrationPreviewStep({
  coverImageUri,
  profileImageUri,
  selectedCategories,
  submit,
  submitError,
  submitting,
  uploadProgress,
  values,
}: ClubRegistrationStepProps) {
  return (
    <>
      <RegistrationStepHeading title="On Izleme" subtitle="Kayıt oncesi bilgilerini kontrol et" />

      <AccountPreviewCard
        accountLabel="Kulüp Hesabı"
        name={values.clubName.trim()}
        username={values.username.trim()}
        email={values.email.trim().toLowerCase()}
        university={values.university.trim()}
        about={values.description.trim()}
        categories={selectedCategories}
        profileImageUri={profileImageUri || undefined}
        coverImageUri={coverImageUri || undefined}
        accent="#7c3aed"
      />

      <RegistrationUploadProgressCard
        accent="#7c3aed"
        backgroundColor="#f5f3ff"
        textColor="#6d28d9"
        message={uploadProgress}
      />
      <RegistrationSubmitError message={submitError} />

      <View style={{ marginTop: 20 }}>
        <GradientButton
          label="Kayıt Ol"
          onPress={() => void submit()}
          loading={submitting}
          variant="primary"
        />
      </View>
    </>
  );
}

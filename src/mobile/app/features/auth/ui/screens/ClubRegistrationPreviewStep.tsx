import { View } from "react-native";

import { GradientButton } from "../../../../shared/components";
import {
  AccountPreviewCard,
  RegistrationStepHeading,
  RegistrationSubmitError,
  RegistrationUploadProgressCard,
} from "../components";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

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
        accent={tokens.colors.violetBrand}
      />

      <RegistrationUploadProgressCard
        accent={tokens.colors.violetBrand}
        backgroundColor={tokens.colors.violetSoft}
        textColor={tokens.colors.violetDark}
        message={uploadProgress}
      />
      <RegistrationSubmitError message={submitError} />

      <View style={{ marginTop: tokens.spacing.lg }}>
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

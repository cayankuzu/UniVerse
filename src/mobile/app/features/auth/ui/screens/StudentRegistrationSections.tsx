import { StudentRegistrationBasicStep } from "./StudentRegistrationBasicStep";
import { StudentRegistrationCategoriesStep } from "./StudentRegistrationCategoriesStep";
import { StudentRegistrationProfileStep } from "./StudentRegistrationProfileStep";
import type { StudentRegistrationSectionsProps } from "../studentRegistrationSections.shared";
import { StudentRegistrationUniversityStep } from "./StudentRegistrationUniversityStep";

export function StudentRegistrationSections({
  coverImageUri,
  emailAvailabilityError,
  emailChecking,
  errors,
  goNext,
  pickImage,
  profileImageUri,
  selectedCategories,
  setField,
  setSelectedCategories,
  step,
  submit,
  submitError,
  submitting,
  uploadProgress,
  usernameAvailabilityError,
  usernameChecking,
  values,
}: StudentRegistrationSectionsProps) {
  const stepProps = {
    coverImageUri,
    emailAvailabilityError,
    emailChecking,
    errors,
    goNext,
    pickImage,
    profileImageUri,
    selectedCategories,
    setField,
    setSelectedCategories,
    submit,
    submitError,
    submitting,
    uploadProgress,
    usernameAvailabilityError,
    usernameChecking,
    values,
  };

  if (step === 1) {
    return <StudentRegistrationBasicStep {...stepProps} />;
  }

  if (step === 2) {
    return <StudentRegistrationUniversityStep {...stepProps} />;
  }

  if (step === 3) {
    return <StudentRegistrationProfileStep {...stepProps} />;
  }

  if (step === 4) {
    return <StudentRegistrationCategoriesStep {...stepProps} />;
  }
  return null;
}

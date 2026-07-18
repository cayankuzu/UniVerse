import { ClubRegistrationBasicStep } from "./ClubRegistrationBasicStep";
import { ClubRegistrationCategoriesStep } from "./ClubRegistrationCategoriesStep";
import { ClubRegistrationProfileStep } from "./ClubRegistrationProfileStep";
import { ClubRegistrationUniversityStep } from "./ClubRegistrationUniversityStep";
import type { ClubRegistrationSectionsProps } from "../clubRegistrationSections.shared";

export function ClubRegistrationSections({ step, ...props }: ClubRegistrationSectionsProps) {
  if (step === 1) {
    return <ClubRegistrationBasicStep {...props} />;
  }

  if (step === 2) {
    return <ClubRegistrationUniversityStep {...props} />;
  }

  if (step === 3) {
    return <ClubRegistrationProfileStep {...props} />;
  }

  if (step === 4) {
    return <ClubRegistrationCategoriesStep {...props} />;
  }
  return null;
}

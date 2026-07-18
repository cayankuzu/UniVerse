interface ClubRegistrationValues {
  clubName: string;
  description: string;
  email: string;
  password: string;
  university: string;
  username: string;
}

export interface ClubRegistrationSectionsProps {
  coverImageUri: string | null;
  emailAvailabilityError: string;
  emailChecking: boolean;
  errors: Record<string, { message?: string } | undefined>;
  goNext: () => Promise<boolean | void> | void;
  pickImage: (type: "profile" | "cover") => Promise<void> | void;
  profileImageUri: string | null;
  selectedCategories: string[];
  setField: (field: string, value: string) => void;
  setSelectedCategories: (value: string[]) => void;
  step: number;
  submit: () => Promise<boolean | void> | void;
  submitError: string;
  submitting: boolean;
  uploadProgress: string;
  usernameAvailabilityError: string;
  usernameChecking: boolean;
  values: ClubRegistrationValues;
}

export type ClubRegistrationStepProps = Pick<
  ClubRegistrationSectionsProps,
  | "coverImageUri"
  | "emailAvailabilityError"
  | "emailChecking"
  | "errors"
  | "goNext"
  | "pickImage"
  | "profileImageUri"
  | "selectedCategories"
  | "setField"
  | "setSelectedCategories"
  | "submit"
  | "submitError"
  | "submitting"
  | "uploadProgress"
  | "usernameAvailabilityError"
  | "usernameChecking"
  | "values"
>;

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRef } from "react";
import type { DefaultValues, FieldPath, FieldValues } from "react-hook-form";
import type { z } from "zod";
import type { PendingVerification } from "../../../data/contracts/auth";
import type { AuthUserData } from "../../../data/contracts/entities";
import {
  useRegistrationWizardState,
  type RegistrationStepDefinition,
  type SubmitContext,
} from "./useRegistrationWizardState";
import { useRegistrationMediaState } from "./useRegistrationMediaState";

type ValidationResult = {
  message?: string;
  valid: boolean;
};

interface RegistrationSessionActions {
  setPendingVerification: (value: PendingVerification) => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
}

interface UseRegistrationWizardParams<TValues extends FieldValues> {
  defaultValues: DefaultValues<TValues>;
  emailValidator: (email: string) => ValidationResult;
  goBackToRegister: () => void;
  initialSelectedCategories?: string[];
  logScope: string;
  registerFields: readonly FieldPath<TValues>[];
  schema: z.ZodType<TValues>;
  sessionActions: RegistrationSessionActions;
  stepDefinitions?: readonly RegistrationStepDefinition<TValues>[];
  submitRegistration: (context: SubmitContext<TValues>) => Promise<void>;
  totalSteps: number;
  usernameValidator: (username: string) => ValidationResult;
}

export function sanitizeUsernameInput(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .toLowerCase();
}

export function useRegistrationWizard<TValues extends FieldValues>(
  params: UseRegistrationWizardParams<TValues>,
) {
  const insets = useSafeAreaInsets();
  const setSubmitErrorRef = useRef<(value: string) => void>(() => undefined);
  const media = useRegistrationMediaState((value) => {
    setSubmitErrorRef.current(value);
  });
  const wizardState = useRegistrationWizardState({
    ...params,
    coverImageUri: media.coverImageUri,
    profileImageUri: media.profileImageUri,
    setPendingVerification: params.sessionActions.setPendingVerification,
    updateUserData: params.sessionActions.updateUserData,
  });
  setSubmitErrorRef.current = wizardState.setSubmitError;

  return {
    ...wizardState,
    closeMediaLibraryPicker: media.closeMediaLibraryPicker,
    closeMediaSourcePicker: media.closeMediaSourcePicker,
    coverImageUri: media.coverImageUri,
    handleMediaLibrarySelection: media.handleMediaLibrarySelection,
    handleMediaSourceAction: media.handleMediaSourceAction,
    insets,
    mediaLibraryVisible: media.mediaLibraryVisible,
    mediaSourceVisible: media.mediaSourceVisible,
    mediaTarget: media.mediaTarget,
    pickImage: media.pickImage,
    profileImageUri: media.profileImageUri,
  };
}

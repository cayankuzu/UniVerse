import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUserData } from "../../../data/contracts/entities";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { showConfirmAlert } from "../../../shared/utils/alerts";
import { checkProfileUsernameAvailability, persistEditedProfile } from "../data";
import { EDIT_PROFILE_TOTAL_STEPS, sanitizeUsername } from "../domain/editProfileForm";
import {
  EditProfileStep,
  getEditProfileStepForField,
  getEditProfileStepDescription,
  getEditProfileStepValidationError,
  getEditProfileValidationErrors,
  getFirstEditProfileInvalidField,
} from "./editProfileScreenState.shared";
import { useEditProfileFormState } from "./useEditProfileFormState";

interface UseEditProfileScreenStateParams {
  accountType: "club" | "student" | null | undefined;
  goBack: () => void;
  resetToProfile: () => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
  userData: AuthUserData;
}

export function useEditProfileScreenState(params: UseEditProfileScreenStateParams) {
  const queryClient = useQueryClient();
  const normalizedAccountType: "club" | "student" =
    params.accountType === "club" ? "club" : "student";
  const isClub = normalizedAccountType === "club";
  const viewerKey = getViewerKey(params.userData);
  const [step, setStep] = useState<EditProfileStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [usernameAvailabilityError, setUsernameAvailabilityError] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const allowExitRef = useRef(false);
  const usernameAbortRef = useRef<AbortController | null>(null);
  const usernameRequestIdRef = useRef(0);
  const formState = useEditProfileFormState({ isClub, userData: params.userData });
  const stepDescription = getEditProfileStepDescription(step);

  useEffect(() => {
    return () => {
      usernameAbortRef.current?.abort();
    };
  }, []);

  const leaveScreen = useCallback(() => {
    allowExitRef.current = true;
    params.goBack();
  }, [params]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((previous) => (previous - 1) as EditProfileStep);
      return;
    }
    if (!formState.hasUnsavedChanges) {
      leaveScreen();
      return;
    }
    showConfirmAlert({
      cancelLabel: "Vazgec",
      confirmLabel: "Cik",
      destructive: true,
      message: "Kaydedilmeyen profil degisiklikleri silinecek.",
      onConfirm: leaveScreen,
      title: "Profilden cikilsin mi?",
    });
  }, [formState.hasUnsavedChanges, leaveScreen, step]);

  const canLeaveScreenWithoutPrompt = useCallback(
    () => allowExitRef.current || !formState.hasUnsavedChanges,
    [formState.hasUnsavedChanges],
  );

  async function validateChangedUsername() {
    const nextUsername = sanitizeUsername(String(formState.getValues("username") || ""));
    if (nextUsername === formState.initialUsername) return null;

    usernameAbortRef.current?.abort();
    const controller = new AbortController();
    usernameAbortRef.current = controller;
    usernameRequestIdRef.current += 1;
    const requestId = usernameRequestIdRef.current;
    setUsernameChecking(true);
    setUsernameAvailabilityError("");

    let availability: Awaited<ReturnType<typeof checkProfileUsernameAvailability>> | null = null;
    let availabilityError = "";
    try {
      availability = await checkProfileUsernameAvailability(nextUsername, {
        signal: controller.signal,
      });
    } catch {
      availabilityError = controller.signal.aborted
        ? "Kullanıcı adı kontrolü iptal edildi. Lütfen tekrar dene."
        : "Kullanıcı adı kontrol edilemedi. Lütfen tekrar dene.";
    }
    const isCurrentController = usernameAbortRef.current === controller;
    if (isCurrentController) {
      usernameAbortRef.current = null;
    }
    if (isCurrentController && formState.isMountedRef.current) {
      setUsernameChecking(false);
    }
    if (!availability) return availabilityError || "Kullanıcı adı kontrol edilemedi.";

    const currentUsername = sanitizeUsername(String(formState.getValues("username") || ""));
    if (!formState.isMountedRef.current || requestId !== usernameRequestIdRef.current) {
      return "Kullanıcı adı değişti. Lütfen tekrar kontrol et.";
    }
    if (currentUsername !== nextUsername) {
      return "Kullanıcı adı değişti. Lütfen tekrar kontrol et.";
    }
    if (availability.available) return null;
    return availability.reason || "Bu kullanıcı adı zaten kullanılıyor.";
  }

  const nextStep = async () => {
    if (step === 1) {
      const valid = await formState.trigger(
        isClub ? ["username", "clubName"] : ["username", "name"],
      );
      if (!valid) {
        formState.setSubmitAttempted(true);
        const validationErrors = getEditProfileValidationErrors(formState.getValues());
        const firstInvalidField = getFirstEditProfileInvalidField({
          errors: validationErrors,
          isClub,
          step,
        });
        if (firstInvalidField) {
          formState.requestFieldFocus(firstInvalidField);
        }
        formState.setSubmitError(
          getEditProfileStepValidationError({
            errors: formState.errors,
            isClub,
            step,
          }),
        );
        return;
      }

      const usernameError = await validateChangedUsername();
      if (usernameError) {
        setUsernameAvailabilityError(usernameError);
        formState.setSubmitError(usernameError);
        formState.requestFieldFocus("username");
        return;
      }
    }

    if (step === 2) {
      const valid = await formState.trigger(
        isClub ? ["email", "university"] : ["email", "university", "department", "gradeYear"],
      );
      if (!valid) {
        formState.setSubmitAttempted(true);
        const validationErrors = getEditProfileValidationErrors(formState.getValues());
        const firstInvalidField = getFirstEditProfileInvalidField({
          errors: validationErrors,
          isClub,
          step,
        });
        if (firstInvalidField) {
          formState.requestFieldFocus(firstInvalidField);
        }
        formState.setSubmitError(
          getEditProfileStepValidationError({
            errors: formState.errors,
            isClub,
            step,
          }),
        );
        return;
      }
    }

    formState.setSubmitError("");
    setStep((previous) => Math.min(EDIT_PROFILE_TOTAL_STEPS, previous + 1) as EditProfileStep);
  };

  const saveProfile = async () => {
    if (submitting) return;
    const valid = await formState.trigger();
    if (!valid) {
      formState.setSubmitAttempted(true);
      const validationErrors = getEditProfileValidationErrors(formState.getValues());
      const firstInvalidField = getFirstEditProfileInvalidField({
        errors: validationErrors,
        isClub,
      });
      if (firstInvalidField) {
        setStep(getEditProfileStepForField(firstInvalidField));
        formState.requestFieldFocus(firstInvalidField);
      }
      formState.setSubmitError("Profil bilgilerini kontrol et.");
      return;
    }

    const nextUsername = sanitizeUsername(String(formState.getValues("username") || ""));
    if (nextUsername.length < 3) {
      setStep(1);
      setUsernameAvailabilityError("Kullanıcı adı en az 3 karakter olmalı.");
      formState.setSubmitError("Kullanıcı adı en az 3 karakter olmalı.");
      formState.requestFieldFocus("username");
      return;
    }

    const usernameError = await validateChangedUsername();
    if (usernameError) {
      setStep(1);
      setUsernameAvailabilityError(usernameError);
      formState.setSubmitError(usernameError);
      formState.requestFieldFocus("username");
      return;
    }

    setSubmitting(true);
    formState.setSubmitError("");

    try {
      await persistEditedProfile({
        accountType: normalizedAccountType,
        coverImageUri: formState.coverImageUri,
        form: formState.getValues(),
        isClub,
        profileImageUri: formState.profileImageUri,
        queryClient,
        selectedCategories: formState.selectedCategories,
        setUploadProgress: (value) => {
          if (!formState.isMountedRef.current) return;
          formState.setUploadProgress(value);
        },
        updateUserData: params.updateUserData as (payload: Record<string, unknown>) => void,
        userData: params.userData as unknown as Record<string, unknown>,
        viewerKey,
      });
      allowExitRef.current = true;
      params.resetToProfile();
    } catch (error: unknown) {
      if (!formState.isMountedRef.current) return;
      formState.setSubmitError(
        String((error as { message?: string })?.message || "Profil güncellenemedi."),
      );
    } finally {
      if (formState.isMountedRef.current) {
        setSubmitting(false);
        formState.setUploadProgress("");
      }
    }
  };

  return {
    ...formState,
    accountType: normalizedAccountType,
    about: formState.about,
    canLeaveScreenWithoutPrompt,
    handleBack,
    isClub,
    saveProfile,
    step,
    stepDescription,
    submitting,
    usernameAvailabilityError,
    usernameChecking,
    clearUsernameAvailabilityError: () => setUsernameAvailabilityError(""),
    TOTAL_STEPS: EDIT_PROFILE_TOTAL_STEPS,
    userData: params.userData,
    nextStep,
  };
}

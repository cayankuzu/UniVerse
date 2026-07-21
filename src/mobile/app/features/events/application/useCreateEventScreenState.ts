import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUserData } from "../../../data/contracts/entities";
import { mapAppDataErrorMessage } from "../../../data/errors/appDataError";
import { showConfirmAlert } from "../../../shared/utils/alerts";
import { startQueuedEventCreate } from "../data";
import {
  type CreateEventFormState,
  TOTAL_CREATE_EVENT_STEPS,
  hasCreateEventDraftChanges,
} from "../domain/createEventForm";
import {
  CREATE_EVENT_STEP_FIELDS,
  formatCreateEventValidationSummary,
  getFirstCreateEventInvalidField,
  getCreateEventValidationErrors,
} from "../domain/createEventScreen.helpers";
import { useCreateEventFormState } from "./useCreateEventFormState";

export function useCreateEventScreenState(params: {
  goBack: () => void;
  resetToHome: () => void;
  setBottomTabsVisible: (visible: boolean) => void;
  userData: AuthUserData;
  viewerKey: string;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const isMountedRef = useRef(true);
  const allowExitRef = useRef(false);
  const formState = useCreateEventFormState();
  const { setStep, step } = formState;
  const { goBack, setBottomTabsVisible } = params;
  const hasUnsavedChanges = hasCreateEventDraftChanges({
    coverImageUri: formState.coverImageUri,
    form: formState.form,
    selectedCategories: formState.selectedCategories,
  });

  useEffect(() => {
    setBottomTabsVisible(false);
    return () => {
      setBottomTabsVisible(true);
    };
  }, [setBottomTabsVisible]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const leaveScreen = useCallback(() => {
    allowExitRef.current = true;
    goBack();
  }, [goBack]);
  const canLeaveScreenWithoutPrompt = useCallback(() => allowExitRef.current, []);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((previous) => Math.max(1, previous - 1));
      return;
    }
    if (!hasUnsavedChanges) {
      leaveScreen();
      return;
    }
    showConfirmAlert({
      cancelLabel: "Vazgec",
      confirmLabel: "Cik",
      destructive: true,
      message: "Kaydedilmeyen etkinlik taslağı silinecek.",
      onConfirm: leaveScreen,
      title: "Taslak kapatilsin mi?",
    });
  }, [hasUnsavedChanges, leaveScreen, setStep, step]);

  const submit = useCallback(async () => {
    const valid = await formState.trigger();
    if (!valid) {
      const validationErrors = getCreateEventValidationErrors(formState.getValues());
      const firstInvalidStep = Object.entries(CREATE_EVENT_STEP_FIELDS).find(([, fields]) =>
        fields.some((field) => Boolean(validationErrors[field])),
      )?.[0];
      if (firstInvalidStep) {
        formState.setStep(Number(firstInvalidStep));
      }
      const firstInvalidField = getFirstCreateEventInvalidField({ errors: validationErrors });
      if (firstInvalidField) {
        formState.requestFieldFocus(firstInvalidField);
      }
      formState.setSubmitAttempted(true);
      formState.setSubmitError(
        formatCreateEventValidationSummary({
          errors: validationErrors,
          limit: 4,
        }) || "Form alanlarini kontrol et.",
      );
      return;
    }
    if (formState.selectedCategories.length === 0) {
      formState.setStep(1);
      formState.setSubmitError("En az bir kategori secmelisin.");
      formState.setSubmitAttempted(true);
      formState.requestFieldFocus("categories");
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    formState.setSubmitError("");
    formState.setUploadProgress("Etkinlik sira aliniyor...");
    try {
      await startQueuedEventCreate({
        coverImageUri: formState.coverImageUri,
        form: formState.getValues() as CreateEventFormState,
        ownerId: params.userData.id,
        queryClient,
        selectedCategories: formState.selectedCategories,
        userData: params.userData,
        viewerKey: params.viewerKey,
      });
      if (!isMountedRef.current) return;

      formState.setUploadProgress("Etkinlik arka planda paylasiliyor...");
      allowExitRef.current = true;
      params.resetToHome();
    } catch (error: unknown) {
      if (!isMountedRef.current) return;

      const message = mapAppDataErrorMessage(
        error,
        {
          forbidden: "Bu etkinliği yayımlama iznin yok.",
          invalid_state: "Etkinlik taslağı geçerli değil.",
          network: "Baglanti sorunu nedeniyle etkinlik olusturulamadi.",
        },
        "Etkinlik olusturulamadi.",
      );
      formState.setSubmitError(message);
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
        formState.setUploadProgress("");
      }
    }
  }, [formState, params, queryClient, submitting]);

  const handlePrimaryAction = useCallback(() => {
    if (formState.step < TOTAL_CREATE_EVENT_STEPS) {
      void formState.goToNextStep();
      return;
    }
    void submit();
  }, [formState, submit]);

  return {
    coverMediaSelection: formState.coverMediaSelection,
    coverImageUri: formState.coverImageUri,
    canLeaveScreenWithoutPrompt,
    cropCoverImage: formState.cropCoverImage,
    cropPending: formState.cropPending,
    clearCoverImage: formState.clearCoverImage,
    closeMediaLibraryPicker: formState.closeMediaLibraryPicker,
    closeMediaSourcePicker: formState.closeMediaSourcePicker,
    form: formState.form,
    fieldErrors: formState.fieldErrors,
    fieldFocusRequest: formState.fieldFocusRequest,
    handleBack,
    handlePrimaryAction,
    handleMediaLibrarySelection: formState.handleMediaLibrarySelection,
    handleMediaSourceAction: formState.handleMediaSourceAction,
    pickCoverImage: formState.pickCoverImage,
    primaryActionDisabled:
      formState.step < TOTAL_CREATE_EVENT_STEPS ? !formState.canContinue : submitting,
    primaryActionLoading: formState.step === TOTAL_CREATE_EVENT_STEPS && submitting,
    selectedCategories: formState.selectedCategories,
    submitAttempted: formState.submitAttempted,
    touchedFields: formState.touchedFields,
    validatingFields: formState.validatingFields,
    mediaLibraryVisible: formState.mediaLibraryVisible,
    mediaSourceVisible: formState.mediaSourceVisible,
    setField: formState.setField,
    setSelectedCategories: formState.setSelectedCategories,
    step: formState.step,
    submitError: formState.submitError,
    uploadProgress: formState.uploadProgress,
    userData: params.userData,
  };
}

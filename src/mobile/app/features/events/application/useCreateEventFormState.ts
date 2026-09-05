import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  captureCameraImageSelection,
  isVideoMediaUri,
  type MediaSelection,
  waitForMediaPickerTransition,
} from "../../../shared/media/mediaPicker";
import { captureTimedVideoSelection } from "../../../shared/media/nativeTimedVideoCapture";
import { cropEventAlbumPhoto } from "./eventAlbumNativeCrop";
import { debugLog, debugWarn } from "../../../platform/logging/logger";
import {
  type CreateEventFormState,
  INITIAL_CREATE_EVENT_FORM,
  TOTAL_CREATE_EVENT_STEPS,
} from "../domain/createEventForm";
import { createEventSchema, type CreateEventFormValues } from "../domain/createEvent.schema";
import {
  canContinueCreateEventStep,
  CREATE_EVENT_STEP_FIELDS,
  formatCreateEventValidationSummary,
  getFirstCreateEventInvalidField,
  getCreateEventValidationErrors,
  mapCreateEventFieldErrors,
} from "../domain/createEventScreen.helpers";

type FieldFocusRequest = {
  fieldName: string;
  revision: number;
};

export function useCreateEventFormState() {
  const [step, setStep] = useState(1);
  const [coverImageUri, setCoverImageUri] = useState("");
  const [coverMediaSelection, setCoverMediaSelection] = useState<MediaSelection | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mediaSourceVisible, setMediaSourceVisible] = useState(false);
  const [mediaLibraryVisible, setMediaLibraryVisible] = useState(false);
  const [cropPending, setCropPending] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const focusRevisionRef = useRef(0);
  const [fieldFocusRequest, setFieldFocusRequest] = useState<FieldFocusRequest | null>(null);
  const {
    clearErrors,
    formState: { errors, touchedFields, validatingFields },
    getValues,
    register,
    setValue,
    trigger,
    watch,
  } = useForm<CreateEventFormValues>({
    defaultValues: INITIAL_CREATE_EVENT_FORM,
    resolver: zodResolver(createEventSchema),
  });
  const form = watch() as CreateEventFormState;
  const fieldErrors = useMemo(() => mapCreateEventFieldErrors(errors), [errors]);

  useEffect(() => {
    (Object.keys(INITIAL_CREATE_EVENT_FORM) as Array<keyof CreateEventFormValues>).forEach(
      (field) => {
        register(field);
      },
    );
  }, [register]);

  const setField = useCallback(
    (key: keyof CreateEventFormValues, value: string) => {
      clearErrors(key);
      setSubmitError("");
      setValue(key, value, { shouldDirty: true, shouldTouch: true });
    },
    [clearErrors, setValue],
  );

  const requestFieldFocus = useCallback((fieldName: keyof CreateEventFormValues | "categories") => {
    focusRevisionRef.current += 1;
    setFieldFocusRequest({ fieldName: String(fieldName), revision: focusRevisionRef.current });
  }, []);

  const closeMediaSourcePicker = useCallback(() => {
    setMediaSourceVisible(false);
  }, []);

  const closeMediaLibraryPicker = useCallback(() => {
    setMediaLibraryVisible(false);
  }, []);

  const clearCoverImage = useCallback(() => {
    setCoverImageUri("");
    setCoverMediaSelection(null);
    setSubmitError("");
  }, []);

  const cropCoverImage = useCallback(async () => {
    if (!coverImageUri || cropPending) return;
    if (isVideoMediaUri(coverImageUri)) {
      setSubmitError("Video kırpılamaz.");
      return;
    }

    setCropPending(true);
    debugLog("MEDIA/EVENT_COVER", "crop-start", { uri: coverImageUri });
    try {
      const croppedUri = await cropEventAlbumPhoto(coverImageUri);
      if (!croppedUri) return;
      setCoverImageUri(croppedUri);
      setCoverMediaSelection({
        durationMs: null,
        fileName: null,
        kind: "image",
        mimeType: "image/jpeg",
        uri: croppedUri,
      });
      setSubmitError("");
      debugLog("MEDIA/EVENT_COVER", "crop-success", {
        croppedUri,
        previousUri: coverImageUri,
      });
    } catch (error) {
      debugWarn("MEDIA/EVENT_COVER", "crop-failed", { error, uri: coverImageUri });
      setSubmitError(
        String((error as { message?: string } | null)?.message || "Medya kırpılamadı."),
      );
    } finally {
      setCropPending(false);
    }
  }, [coverImageUri, cropPending]);

  const handleMediaSourceAction = useCallback(
    async (action: "camera-photo" | "camera-video" | "library") => {
      setMediaSourceVisible(false);
      await waitForMediaPickerTransition();
      try {
        if (action === "camera-photo") {
          const selection = await captureCameraImageSelection({ quality: 0.85 });
          if (!selection?.uri) return;
          setCoverImageUri(selection.uri);
          setCoverMediaSelection(selection);
          setSubmitError("");
          return;
        }

        if (action === "camera-video") {
          const selection = await captureTimedVideoSelection();
          if (!selection?.uri) return;
          setCoverImageUri(selection.uri);
          setCoverMediaSelection(selection);
          setSubmitError("");
          return;
        }

        if (action === "library") {
          setMediaLibraryVisible(true);
        }
      } catch (error) {
        setSubmitError(
          String((error as { message?: string } | null)?.message || "Medyalar seçilemedi."),
        );
      }
    },
    [],
  );

  const handleMediaLibrarySelection = useCallback((items: MediaSelection[]) => {
    const firstAsset = items[0];
    if (!firstAsset?.uri) return;
    setCoverImageUri(firstAsset.uri);
    setCoverMediaSelection(firstAsset);
    setSubmitError("");
    setMediaLibraryVisible(false);
  }, []);

  const pickCoverImage = useCallback(() => {
    setMediaSourceVisible(true);
  }, []);

  const goToNextStep = useCallback(async () => {
    const isValid = await trigger(CREATE_EVENT_STEP_FIELDS[step]);
    if (!isValid) {
      setSubmitAttempted(true);
      const validationErrors = getCreateEventValidationErrors(getValues());
      const firstInvalidField = getFirstCreateEventInvalidField({
        errors: validationErrors,
        fields: CREATE_EVENT_STEP_FIELDS[step],
      });
      if (firstInvalidField) {
        requestFieldFocus(firstInvalidField);
      }
      setSubmitError(
        formatCreateEventValidationSummary({ errors: validationErrors, step }) ||
          "Form alanlarini kontrol et.",
      );
      return;
    }
    if (step === 1 && selectedCategories.length === 0) {
      setSubmitAttempted(true);
      setSubmitError("En az bir kategori secmelisin.");
      requestFieldFocus("categories");
      return;
    }

    setSubmitError("");
    setStep((previous) => Math.min(TOTAL_CREATE_EVENT_STEPS, previous + 1));
  }, [getValues, requestFieldFocus, selectedCategories.length, step, trigger]);

  const canContinue =
    canContinueCreateEventStep(step, form) && (step !== 1 || selectedCategories.length > 0);

  return {
    canContinue,
    coverMediaSelection,
    coverImageUri,
    cropCoverImage,
    cropPending,
    clearCoverImage,
    form,
    fieldErrors,
    fieldFocusRequest,
    getValues,
    goToNextStep,
    handleMediaSourceAction,
    handleMediaLibrarySelection,
    pickCoverImage,
    closeMediaSourcePicker,
    closeMediaLibraryPicker,
    mediaLibraryVisible,
    mediaSourceVisible,
    selectedCategories,
    requestFieldFocus,
    setField,
    setSelectedCategories,
    setStep,
    setSubmitAttempted,
    setSubmitError,
    setUploadProgress,
    step,
    submitAttempted,
    submitError,
    touchedFields,
    trigger,
    uploadProgress,
    validatingFields,
  };
}

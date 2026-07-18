import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
} from "react-hook-form";
import type { z } from "zod";
import type { PendingVerification } from "../../../data/contracts/auth";
import { debugLog, debugWarn } from "../../../platform/logging/logger";
import type { AuthUserData } from "../../../data/contracts/entities";
import { useUniquenessChecks } from "./useUniquenessChecks";

type ValidationResult = {
  message?: string;
  valid: boolean;
};

type FieldFocusRequest = {
  fieldName: string;
  revision: number;
};

export interface SubmitContext<TValues extends FieldValues> {
  coverImageUri: string;
  normalizedEmail: string;
  normalizedUsername: string;
  profileImageUri: string;
  selectedCategories: string[];
  setPendingVerification: (value: PendingVerification) => void;
  setUploadProgress: (value: string) => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
  values: TValues;
}

export interface RegistrationStepValidationContext<TValues extends FieldValues> {
  checkEmailAvailability: (email: string, options?: { force?: boolean }) => Promise<boolean>;
  checkUsernameAvailability: (username: string, options?: { force?: boolean }) => Promise<boolean>;
  selectedCategories: string[];
  setSubmitError: (value: string) => void;
  step: number;
  trigger: (names?: FieldPath<TValues> | FieldPath<TValues>[]) => Promise<boolean>;
  values: TValues;
}

export interface RegistrationStepDefinition<TValues extends FieldValues> {
  fields?: readonly FieldPath<TValues>[];
  validateStep?: (
    context: RegistrationStepValidationContext<TValues>,
  ) => Promise<boolean> | boolean;
}

interface UseRegistrationWizardStateParams<TValues extends FieldValues> {
  coverImageUri: string;
  defaultValues: DefaultValues<TValues>;
  emailValidator: (email: string) => ValidationResult;
  goBackToRegister: () => void;
  initialSelectedCategories?: string[];
  logScope: string;
  profileImageUri: string;
  registerFields: readonly FieldPath<TValues>[];
  schema: z.ZodType<TValues>;
  setPendingVerification: (value: PendingVerification) => void;
  stepDefinitions?: readonly RegistrationStepDefinition<TValues>[];
  submitRegistration: (context: SubmitContext<TValues>) => Promise<void>;
  totalSteps: number;
  updateUserData: (data: Partial<AuthUserData>) => void;
  usernameValidator: (username: string) => ValidationResult;
}

export function useRegistrationWizardState<TValues extends FieldValues>(
  params: UseRegistrationWizardStateParams<TValues>,
) {
  const {
    coverImageUri,
    defaultValues,
    emailValidator,
    goBackToRegister,
    initialSelectedCategories = [],
    logScope,
    profileImageUri,
    registerFields,
    schema,
    setPendingVerification,
    stepDefinitions = [],
    submitRegistration,
    totalSteps,
    updateUserData,
    usernameValidator,
  } = params;

  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialSelectedCategories);
  const [emailAvailabilityError, setEmailAvailabilityError] = useState("");
  const [usernameAvailabilityError, setUsernameAvailabilityError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const focusRevisionRef = useRef(0);
  const [fieldFocusRequest, setFieldFocusRequest] = useState<FieldFocusRequest | null>(null);

  const {
    clearErrors,
    formState: { errors },
    getValues,
    register,
    setValue,
    trigger,
    watch,
  } = useForm<TValues>({
    defaultValues,
    resolver: zodResolver(schema as never) as never,
  });
  const values = watch();

  useEffect(() => {
    registerFields.forEach((field) => {
      register(field);
    });
  }, [register, registerFields]);

  const validateEmail = (email: string) => {
    const result = emailValidator(email.trim().toLowerCase());
    setEmailAvailabilityError(result.valid ? "" : result.message || "Geçerli e-posta gir");
    return result.valid;
  };

  const validateUsername = (username: string) => {
    const result = usernameValidator(username.trim());
    setUsernameAvailabilityError(result.valid ? "" : result.message || "Kullanıcı adı geçersiz");
    return result.valid;
  };

  const { usernameChecking, emailChecking, checkUsernameAvailability, checkEmailAvailability } =
    useUniquenessChecks({
      validateUsername,
      validateEmail,
      setUsernameError: setUsernameAvailabilityError,
      setEmailError: setEmailAvailabilityError,
      liveUsername: { enabled: step === 1, value: String(values.username || "") },
      liveEmail: { enabled: step === 2, value: String(values.email || "") },
    });

  const setField = <K extends FieldPath<TValues>>(key: K, value: FieldPathValue<TValues, K>) => {
    clearErrors(key);
    setSubmitError("");
    setValue(key, value, { shouldDirty: true, shouldTouch: true });
  };

  const requestFieldFocus = useCallback((fieldName: string) => {
    const normalized = fieldName.trim();
    if (!normalized) return;
    focusRevisionRef.current += 1;
    setFieldFocusRequest({ fieldName: normalized, revision: focusRevisionRef.current });
  }, []);

  const getFirstInvalidField = useCallback(
    (fields?: readonly FieldPath<TValues>[]) => {
      const allowedFields = fields?.map((field) => String(field));
      const parsed = schema.safeParse(getValues());
      if (parsed.success) return allowedFields?.[0] ?? null;

      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] || "");
        if (!field) continue;
        if (!allowedFields || allowedFields.includes(field)) return field;
      }
      return allowedFields?.[0] ?? null;
    },
    [getValues, schema],
  );

  const moveToFieldOwnerStep = useCallback(
    (fieldName: string) => {
      const ownerIndex = stepDefinitions.findIndex((definition) =>
        definition.fields?.some((field) => String(field) === fieldName),
      );
      if (ownerIndex >= 0) {
        setStep(ownerIndex + 1);
      }
    },
    [stepDefinitions],
  );

  const moveToFirstInvalidStep = () => {
    const parsed = schema.safeParse(getValues());
    if (parsed.success) return false;

    const invalidField = parsed.error.issues
      .map((issue) => String(issue.path[0] || ""))
      .find(Boolean);
    if (!invalidField) return false;

    moveToFieldOwnerStep(invalidField);
    requestFieldFocus(invalidField);
    setSubmitError("Lütfen işaretlenen alanı düzeltip tekrar dene.");
    return true;
  };

  const goNext = async () => {
    setSubmitError("");
    const stepDefinition = stepDefinitions[step - 1];
    if (stepDefinition?.fields?.length) {
      const isStepValid = await trigger([...stepDefinition.fields] as FieldPath<TValues>[]);
      if (!isStepValid) {
        const firstInvalidField = getFirstInvalidField(stepDefinition.fields);
        if (firstInvalidField) {
          requestFieldFocus(firstInvalidField);
        }
        return false;
      }
    }

    if (stepDefinition?.validateStep) {
      const canAdvance = await stepDefinition.validateStep({
        checkEmailAvailability,
        checkUsernameAvailability,
        selectedCategories,
        setSubmitError,
        step,
        trigger,
        values,
      });
      if (!canAdvance) {
        const firstInvalidField =
          getFirstInvalidField(stepDefinition.fields) ||
          (step === totalSteps ? "categories" : null);
        if (firstInvalidField) {
          requestFieldFocus(firstInvalidField);
        }
        return false;
      }
    }

    setStep((previous) => Math.min(totalSteps, previous + 1));
    return true;
  };

  const goBack = () => {
    if (step === 1) {
      goBackToRegister();
      return;
    }
    setStep((previous) => Math.max(1, previous - 1));
  };

  const submit = async () => {
    if (submitting) return;
    if (selectedCategories.length === 0) {
      setSubmitError("En az bir kategori seçmelisin.");
      setStep(totalSteps);
      requestFieldFocus("categories");
      return;
    }

    const valid = await trigger();
    if (!valid) {
      moveToFirstInvalidStep();
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setUploadProgress("");
    debugLog(logScope, "submit-started");

    try {
      const currentValues = getValues();
      const [usernameOk, emailOk] = await Promise.all([
        checkUsernameAvailability(String(currentValues.username || ""), { force: true }),
        checkEmailAvailability(String(currentValues.email || ""), { force: true }),
      ]);
      if (!usernameOk || !emailOk) {
        const invalidField = !usernameOk ? "username" : "email";
        moveToFieldOwnerStep(invalidField);
        requestFieldFocus(invalidField);
        throw new Error("Kullanıcı adı veya e-posta kullanılamıyor. Lütfen farklı bir değer gir.");
      }

      await submitRegistration({
        coverImageUri,
        normalizedEmail: String(currentValues.email || "")
          .trim()
          .toLowerCase(),
        normalizedUsername: String(currentValues.username || "")
          .trim()
          .toLowerCase(),
        profileImageUri,
        selectedCategories,
        setPendingVerification,
        setUploadProgress,
        updateUserData,
        values: currentValues,
      });
    } catch (error: unknown) {
      const message = String(
        (error as { message?: string } | null)?.message ||
          error ||
          "Kayıt sirasinda bir hata olustu.",
      );
      debugWarn(logScope, "submit-failed", { message });
      setSubmitError(message);
      setUploadProgress("");
    } finally {
      setSubmitting(false);
      debugLog(logScope, "submit-finished");
    }
  };

  return {
    checkEmailAvailability,
    checkUsernameAvailability,
    emailAvailabilityError,
    emailChecking,
    errors,
    fieldFocusRequest,
    goBack,
    goNext,
    selectedCategories,
    setField,
    setSelectedCategories,
    setStep,
    setSubmitError,
    step,
    submit,
    submitError,
    submitting,
    totalSteps,
    trigger,
    uploadProgress,
    usernameAvailabilityError,
    usernameChecking,
    values,
  };
}

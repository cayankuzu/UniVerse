import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { z } from "zod";
import { useAuth } from "../../../../app-shell/auth";
import { resetToRouteWhenReady } from "../../../../app-shell/navigation/safeReset";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { RegistrationScreenLayout } from "../components";
import { MediaLibraryPickerSheet } from "../../../../shared/media/MediaLibraryPickerSheet";
import { MediaSourceSheet } from "../../../../shared/media/MediaSourceSheet";
import { buildClubRegistrationPayloads } from "../../data";
import { useRegistrationWizard } from "../../application/useRegistrationWizard";
import { clubRegisterSchema } from "../../domain/schemas";
import { completeRegistrationFlow } from "../../application/completeRegistrationFlow";
import { ClubRegistrationSections } from "./ClubRegistrationSections";

type Props = NativeStackScreenProps<RootStackParamList, "ClubRegister">;

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Bilgiler", "Üniversite", "Profil", "Kategoriler"] as const;
const GRADIENT_COLORS = ["#8b5cf6", "#7c3aed"] as const;
const clubRegisterFormSchema = clubRegisterSchema;

type ClubRegisterValues = z.infer<typeof clubRegisterFormSchema>;

export function ClubRegisterScreen({ navigation }: Props) {
  const { setPendingVerification, updateUserData } = useAuth();
  const wizard = useRegistrationWizard<ClubRegisterValues>({
    defaultValues: {
      clubName: "",
      description: "",
      email: "",
      password: "",
      university: "",
      username: "",
    },
    emailValidator: (email) => {
      const parsed = clubRegisterSchema.shape.email.safeParse(email);
      return {
        valid: parsed.success,
        message: parsed.error?.issues[0]?.message || "Geçerli e-posta gir",
      };
    },
    goBackToRegister: () => navigation.navigate("Register"),
    logScope: "REGISTER/CLUB",
    registerFields: ["clubName", "description", "email", "password", "university", "username"],
    schema: clubRegisterFormSchema,
    sessionActions: {
      setPendingVerification,
      updateUserData,
    },
    stepDefinitions: [
      {
        fields: ["username", "clubName"],
        validateStep: async ({ checkUsernameAvailability, values }) =>
          checkUsernameAvailability(String(values.username || "")),
      },
      {
        fields: ["email", "university"],
        validateStep: async ({ checkEmailAvailability, values }) =>
          checkEmailAvailability(String(values.email || "")),
      },
      { fields: ["description", "password"] },
      {
        validateStep: ({ selectedCategories, setSubmitError }) => {
          if (selectedCategories.length > 0) {
            return true;
          }
          setSubmitError("En az bir kategori seçmelisin.");
          return false;
        },
      },
    ],
    submitRegistration: async ({
      coverImageUri,
      normalizedEmail,
      normalizedUsername,
      profileImageUri,
      selectedCategories,
      setPendingVerification,
      setUploadProgress,
      updateUserData,
      values,
    }) => {
      const { registerPayload, updatePayload } = buildClubRegistrationPayloads({
        normalizedEmail,
        normalizedUsername,
        selectedCategories,
        values,
      });
      await completeRegistrationFlow({
        coverImageContext: "club-register-cover",
        coverImageFileName: `club-cover-${Date.now()}.jpg`,
        coverImageUri,
        goToVerifyEmail: (email) => navigation.navigate("VerifyEmail", { email }),
        normalizedEmail,
        normalizedUsername,
        profileImageContext: "club-register-logo",
        profileImageFileName: `club-logo-${Date.now()}.jpg`,
        profileImageUri,
        registerPayload,
        resetToHome: () => resetToRouteWhenReady(navigation, "Home"),
        setPendingVerification,
        setUploadProgress,
        updatePayload,
        updateUserData,
      });
    },
    totalSteps: TOTAL_STEPS,
    usernameValidator: (username) => {
      const parsed = clubRegisterSchema.shape.username.safeParse(username);
      return {
        valid: parsed.success,
        message: parsed.error?.issues[0]?.message || "Kullanıcı adı geçersiz",
      };
    },
  });

  const {
    coverImageUri,
    closeMediaLibraryPicker,
    closeMediaSourcePicker,
    emailAvailabilityError,
    emailChecking,
    errors,
    fieldFocusRequest,
    goBack,
    goNext,
    handleMediaLibrarySelection,
    handleMediaSourceAction,
    insets,
    mediaLibraryVisible,
    mediaSourceVisible,
    mediaTarget,
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
  } = wizard;

  return (
    <RegistrationScreenLayout
      title="Kulüp Kayıt"
      step={step}
      totalSteps={TOTAL_STEPS}
      stepLabels={STEP_LABELS}
      colors={GRADIENT_COLORS}
      bottomInset={insets.bottom}
      focusRequest={fieldFocusRequest}
      onBack={goBack}
    >
      <ClubRegistrationSections
        coverImageUri={coverImageUri}
        emailAvailabilityError={emailAvailabilityError}
        emailChecking={emailChecking}
        errors={errors as Record<string, { message?: string } | undefined>}
        goNext={goNext}
        pickImage={pickImage}
        profileImageUri={profileImageUri}
        selectedCategories={selectedCategories}
        setField={(field, value) => setField(field as keyof ClubRegisterValues, value as never)}
        setSelectedCategories={setSelectedCategories}
        step={step}
        submit={submit}
        submitError={submitError}
        submitting={submitting}
        uploadProgress={uploadProgress}
        usernameAvailabilityError={usernameAvailabilityError}
        usernameChecking={usernameChecking}
        values={values}
      />

      <MediaSourceSheet
        allowVideo={false}
        description="Logo ve kapak için fotoğraf çekebilir veya galeriden seçim yapabilirsin."
        onClose={closeMediaSourcePicker}
        onSelect={handleMediaSourceAction}
        subtitle={mediaTarget === "cover" ? "Kapak fotoğrafı" : "Kulüp logosu"}
        title="Medya seç"
        visible={mediaSourceVisible}
      />
      <MediaLibraryPickerSheet
        allowVideo={false}
        description="Fotoğraflar sekmesinden 3 sütunlu grid ile seçim yap."
        maxSelectionCount={1}
        onClose={closeMediaLibraryPicker}
        onConfirm={handleMediaLibrarySelection}
        selectionMode="single"
        subtitle={mediaTarget === "cover" ? "Kapak için fotoğraf" : "Logo için fotoğraf"}
        title="Medya ekle"
        visible={mediaLibraryVisible}
      />
    </RegistrationScreenLayout>
  );
}

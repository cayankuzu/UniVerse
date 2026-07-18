import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { z } from "zod";
import { useAuth } from "../../../../app-shell/auth";
import { resetToRouteWhenReady } from "../../../../app-shell/navigation/safeReset";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { RegistrationScreenLayout } from "../components";
import { MediaLibraryPickerSheet } from "../../../../shared/media/MediaLibraryPickerSheet";
import { MediaSourceSheet } from "../../../../shared/media/MediaSourceSheet";
import { buildStudentRegistrationPayloads } from "../../data";
import { useRegistrationWizard } from "../../application/useRegistrationWizard";
import { studentRegisterSchema } from "../../domain/schemas";
import { completeRegistrationFlow } from "../../application/completeRegistrationFlow";
import { StudentRegistrationSections } from "./StudentRegistrationSections";

type Props = NativeStackScreenProps<RootStackParamList, "StudentRegister">;

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Bilgiler", "Üniversite", "Profil", "İlgi Alanları"] as const;
const GRADIENT_COLORS = ["#3b82f6", "#2563eb"] as const;
const studentRegisterFormSchema = studentRegisterSchema.extend({
  bio: z.string().max(150, "Biyografi en fazla 150 karakter olabilir."),
});

type StudentRegisterValues = z.infer<typeof studentRegisterFormSchema>;

export function StudentRegisterScreen({ navigation }: Props) {
  const { setPendingVerification, updateUserData } = useAuth();
  const wizard = useRegistrationWizard<StudentRegisterValues>({
    defaultValues: {
      bio: "",
      department: "",
      email: "",
      gradeYear: "",
      name: "",
      password: "",
      university: "",
      username: "",
    },
    emailValidator: (email) => {
      const parsed = studentRegisterSchema.shape.email.safeParse(email);
      return {
        valid: parsed.success,
        message: parsed.error?.issues[0]?.message || "Geçerli e-posta gir",
      };
    },
    goBackToRegister: () => navigation.navigate("Register"),
    logScope: "REGISTER/STUDENT",
    registerFields: [
      "bio",
      "department",
      "email",
      "gradeYear",
      "name",
      "password",
      "university",
      "username",
    ],
    schema: studentRegisterFormSchema,
    sessionActions: {
      setPendingVerification,
      updateUserData,
    },
    stepDefinitions: [
      {
        fields: ["username", "name"],
        validateStep: async ({ checkUsernameAvailability, values }) =>
          checkUsernameAvailability(String(values.username || "")),
      },
      {
        fields: ["email", "university", "department", "gradeYear"],
        validateStep: async ({ checkEmailAvailability, values }) =>
          checkEmailAvailability(String(values.email || "")),
      },
      { fields: ["bio", "password"] },
      {
        validateStep: ({ selectedCategories, setSubmitError }) => {
          if (selectedCategories.length > 0) {
            return true;
          }
          setSubmitError("En az bir ilgi alanı seçmelisin.");
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
      setPendingVerification: setPending,
      setUploadProgress,
      updateUserData: updateUser,
      values,
    }) => {
      const { registerPayload, updatePayload } = buildStudentRegistrationPayloads({
        normalizedEmail,
        normalizedUsername,
        selectedCategories,
        values,
      });
      await completeRegistrationFlow({
        coverImageContext: "student-register-cover",
        coverImageFileName: `cover-${Date.now()}.jpg`,
        coverImageUri,
        goToVerifyEmail: (email) => navigation.navigate("VerifyEmail", { email }),
        normalizedEmail,
        normalizedUsername,
        profileImageContext: "student-register-profile",
        profileImageFileName: `profile-${Date.now()}.jpg`,
        profileImageUri,
        registerPayload,
        resetToHome: () => resetToRouteWhenReady(navigation, "Home"),
        setPendingVerification: setPending,
        setUploadProgress,
        updatePayload,
        updateUserData: updateUser,
      });
    },
    totalSteps: TOTAL_STEPS,
    usernameValidator: (username) => {
      const parsed = studentRegisterSchema.shape.username.safeParse(username);
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
      title="Öğrenci Kayıt"
      step={step}
      totalSteps={TOTAL_STEPS}
      stepLabels={STEP_LABELS}
      colors={GRADIENT_COLORS}
      bottomInset={insets.bottom}
      focusRequest={fieldFocusRequest}
      onBack={goBack}
    >
      <StudentRegistrationSections
        coverImageUri={coverImageUri}
        emailAvailabilityError={emailAvailabilityError}
        emailChecking={emailChecking}
        errors={errors as Record<string, { message?: string } | undefined>}
        goNext={goNext}
        pickImage={pickImage}
        profileImageUri={profileImageUri}
        selectedCategories={selectedCategories}
        setField={(field, value) => setField(field as keyof StudentRegisterValues, value as never)}
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
        description="Profil ve kapak için fotoğraf çekebilir veya galeriden seçim yapabilirsin."
        onClose={closeMediaSourcePicker}
        onSelect={handleMediaSourceAction}
        subtitle={mediaTarget === "cover" ? "Kapak fotoğrafı" : "Profil fotoğrafı"}
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
        subtitle={mediaTarget === "cover" ? "Kapak için fotoğraf" : "Profil için fotoğraf"}
        title="Medya ekle"
        visible={mediaLibraryVisible}
      />
    </RegistrationScreenLayout>
  );
}

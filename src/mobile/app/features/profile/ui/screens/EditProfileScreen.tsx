import React, { useEffect } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "../../../../shared/theme";
import { useAuth } from "../../../../app-shell/auth";
import { safeResetToRoute } from "../../../../app-shell/navigation/safeReset";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { BackHeader, GradientButton, KeyboardSafeForm } from "../../../../shared/components";
import { MediaLibraryPickerSheet } from "../../../../shared/media/MediaLibraryPickerSheet";
import { MediaSourceSheet } from "../../../../shared/media/MediaSourceSheet";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { EDIT_PROFILE_STEP_LABELS as STEP_LABELS } from "../../domain";
import { EditProfileStepBasic } from "./EditProfileStepBasic";
import { EditProfileStepCategories } from "./EditProfileStepCategories";
import { EditProfileStepProfile } from "./EditProfileStepProfile";
import { EditProfileStepUniversity } from "./EditProfileStepUniversity";
import { useEditProfileScreenState } from "../../application/useEditProfileScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
  const { accountType, updateUserData, userData } = useAuth();
  const bottomPadding = useBottomNavPadding(14, 30);
  const state = useEditProfileScreenState({
    accountType,
    goBack: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      safeResetToRoute(navigation, "Profile");
    },
    resetToProfile: () => {
      safeResetToRoute(navigation, "Profile");
    },
    updateUserData,
    userData,
  });

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (state.canLeaveScreenWithoutPrompt()) return;
      event.preventDefault();
      state.handleBack();
    });
  }, [navigation, state]);
  const hasInlineValidationError =
    Object.values(state.fieldErrors).some(Boolean) || Boolean(state.usernameAvailabilityError);
  const visibleSubmitError =
    state.submitError && !hasInlineValidationError ? state.submitError : "";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <BackHeader
        title="Profili Düzenle"
        onBack={state.handleBack}
        right={
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.semibold,
            }}
          >
            {state.step}/{state.TOTAL_STEPS}
          </Text>
        }
      />

      <View
        style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: tokens.colors.border,
          marginHorizontal: tokens.spacing.lg,
          marginBottom: tokens.spacing.xs,
        }}
      >
        <View
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: tokens.colors.primary,
            width: `${(state.step / state.TOTAL_STEPS) * 100}%`,
          }}
        />
      </View>

      <KeyboardSafeForm
        backgroundColor={tokens.colors.background}
        bottomInsetOwner="screen"
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: 10,
          paddingBottom: bottomPadding,
          gap: tokens.spacing.sm,
        }}
        scrollProps={{ keyboardShouldPersistTaps: "handled" }}
        focusRequest={state.fieldFocusRequest}
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.title,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            {STEP_LABELS[state.step - 1]}
          </Text>
          <Text style={{ color: tokens.colors.muted, fontSize: 13 }}>{state.stepDescription}</Text>
        </View>

        {state.step === 1 ? (
          <EditProfileStepBasic
            errors={{
              clubName: state.fieldErrors.clubName,
              name: state.fieldErrors.name,
              username: state.fieldErrors.username || state.usernameAvailabilityError,
            }}
            isClub={state.isClub}
            username={state.form.username}
            usernameChecking={state.usernameChecking}
            displayName={state.displayName}
            onUsernameChange={(value) => {
              state.clearUsernameAvailabilityError();
              state.setUsername(value);
            }}
            onDisplayNameChange={(value) =>
              state.setField(state.isClub ? "clubName" : "name", value)
            }
          />
        ) : null}

        {state.step === 2 ? (
          <EditProfileStepUniversity
            errors={{
              department: state.fieldErrors.department,
              email: state.fieldErrors.email,
              gradeYear: state.fieldErrors.gradeYear,
              university: state.fieldErrors.university,
            }}
            isClub={state.isClub}
            email={state.form.email}
            university={state.form.university}
            department={state.form.department || ""}
            gradeYear={state.form.gradeYear || ""}
            onEmailChange={(value) => state.setField("email", value)}
            onUniversityChange={(value) => state.setField("university", value)}
            onDepartmentChange={(value) => state.setField("department", value)}
            onGradeYearChange={(value) => state.setField("gradeYear", value)}
          />
        ) : null}

        {state.step === 3 ? (
          <EditProfileStepProfile
            errors={{
              bio: state.fieldErrors.bio,
              description: state.fieldErrors.description,
            }}
            isClub={state.isClub}
            coverImageUri={state.coverImageUri}
            profileImageUri={state.profileImageUri}
            about={state.about}
            onPickCover={() => void state.pickImage("cover")}
            onPickProfile={() => void state.pickImage("profile")}
            onAboutChange={(value) => state.setField(state.isClub ? "description" : "bio", value)}
          />
        ) : null}

        {state.step === 4 ? (
          <EditProfileStepCategories
            accountType={state.accountType}
            allowPreviewToggle={false}
            showPreview={false}
            categorySearch={state.categorySearch}
            filteredCategories={state.filteredCategories}
            selectedCategories={state.selectedCategories}
            username={state.form.username}
            displayName={state.displayName}
            email={state.form.email}
            university={state.form.university}
            department={state.form.department || ""}
            gradeYear={state.form.gradeYear || ""}
            about={state.about}
            profileImageUri={state.profileImageUri}
            coverImageUri={state.coverImageUri}
            followers={state.userData.followers || 0}
            following={state.userData.following || 0}
            hideEmail={state.hideEmail}
            onCategorySearchChange={state.setCategorySearch}
            onToggleCategory={state.toggleCategory}
          />
        ) : null}

        {state.uploadProgress ? (
          <View
            style={{
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: tokens.colors.primaryBorder,
              backgroundColor: tokens.colors.primarySofter,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: tokens.colors.primaryDark,
                fontSize: 13,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {state.uploadProgress}
            </Text>
          </View>
        ) : null}

        {visibleSubmitError ? (
          <View
            style={{
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: tokens.colors.dangerBorder,
              backgroundColor: tokens.colors.dangerSoft,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: tokens.colors.danger,
                fontSize: 13,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {visibleSubmitError}
            </Text>
          </View>
        ) : null}

        {state.step < state.TOTAL_STEPS ? (
          <GradientButton label="Devam Et" onPress={() => void state.nextStep()} />
        ) : (
          <GradientButton
            label="Kaydet"
            onPress={() => void state.saveProfile()}
            loading={state.submitting}
            disabled={state.submitting}
          />
        )}
      </KeyboardSafeForm>

      <MediaSourceSheet
        allowVideo={false}
        description="Profil ve kapak için fotoğraf çekebilir veya galeriden seçim yapabilirsin."
        onClose={state.closeMediaSourcePicker}
        onSelect={state.handleMediaSourceAction}
        subtitle={state.mediaTarget === "cover" ? "Kapak fotoğrafı" : "Profil fotoğrafı"}
        title="Medya seç"
        visible={state.mediaSourceVisible}
      />
      <MediaLibraryPickerSheet
        allowVideo={false}
        description="Fotoğraflar sekmesinden 3 sütunlu grid ile seçim yap."
        maxSelectionCount={1}
        onClose={state.closeMediaLibraryPicker}
        onConfirm={state.handleMediaLibrarySelection}
        selectionMode="single"
        subtitle={state.mediaTarget === "cover" ? "Kapak için fotoğraf" : "Profil için fotoğraf"}
        title="Medya ekle"
        visible={state.mediaLibraryVisible}
      />
    </View>
  );
}

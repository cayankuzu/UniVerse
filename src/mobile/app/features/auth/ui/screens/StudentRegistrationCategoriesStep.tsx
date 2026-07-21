import { GraduationCap } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";

import { categories } from "../../../../shared/catalog/taxonomy";
import { CategorySelector, GradientButton } from "../../../../shared/components";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";
import {
  RegistrationSelectionBadge,
  RegistrationSubmitError,
  RegistrationUploadProgressCard,
} from "../components";
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";
import { tokens } from "../../../../shared/theme";

export function StudentRegistrationCategoriesStep({
  selectedCategories,
  setSelectedCategories,
  submit,
  submitError,
  submitting,
  uploadProgress,
}: StudentRegistrationStepProps) {
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          marginBottom: tokens.spacing.xxs,
        }}
      >
        <GraduationCap size={18} color={tokens.colors.primary} strokeWidth={1.5} />
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.sectionTitle,
            fontWeight: "700",
          }}
        >
          İlgi Alanları
        </Text>
      </View>
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.body,
          marginBottom: tokens.spacing.lg,
        }}
      >
        İlgilendiğin konuları seç
      </Text>

      <CategorySelector
        errorText={selectedCategories.length === 0 ? submitError : undefined}
        fieldName="categories"
        label="Kategoriler"
        selected={selectedCategories}
        options={categories}
        onChange={setSelectedCategories}
        accent={tokens.colors.primary}
        maxSelections={TEXT_LIMITS.category.maxSelections}
        searchPlaceholder="İlgi alanı ara..."
      />
      <RegistrationSelectionBadge
        accent={tokens.colors.blue}
        backgroundColor={tokens.colors.primarySofter}
        textColor={tokens.colors.primaryDark}
        label={`${selectedCategories.length} kategori seçildi`}
      />
      <RegistrationUploadProgressCard
        accent={tokens.colors.primary}
        backgroundColor={tokens.colors.primarySofter}
        textColor={tokens.colors.primaryDark}
        message={uploadProgress}
      />
      <RegistrationSubmitError message={selectedCategories.length === 0 ? "" : submitError} />

      <View style={{ marginTop: tokens.spacing.lg }}>
        <GradientButton
          label="Kayıt Ol"
          onPress={() => void submit()}
          disabled={selectedCategories.length === 0 || submitting}
          loading={submitting}
        />
      </View>
    </>
  );
}
